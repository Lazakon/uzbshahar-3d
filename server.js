require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


console.log("DATABASE_URL mavjud:", !!process.env.DATABASE_URL);

try {
  const db = new URL(process.env.DATABASE_URL);
  console.log("DATABASE HOST:", db.hostname);
  console.log("DATABASE NAME:", db.pathname);
} catch (err) {
  console.log("DATABASE URL xatosi:", err.message);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getHousePosition(index) {
  let count = 0;

  for (let r = 0; r < 1000; r++) {
    let cells = [];

    if (r === 0) {
      cells = [[-1,-1], [0,0], [0,-1], [-1,0]];
    } else {
      const min = -r - 1;
      const max = r;

      for (let x = min; x <= max; x++) cells.push([x,min]);
      for (let z = min+1; z <= max; z++) cells.push([max,z]);
      for (let x = max-1; x >= min; x--) cells.push([x,max]);
      for (let z = max-1; z > min; z--) cells.push([min,z]);
    }

    for (const [x,z] of cells) {
      if (count === index) {
        return {x: x * 16 + 8, z: z * 16 + 8};
      }
      count++;
    }
  }

  throw new Error('Uy joylashuvi topilmadi');
}

function formatUser(row) {
  return {
    username: row.username,
    registeredAt: row.registered_at,
    profile: {
      displayName: row.display_name || row.username,
      bio: row.bio || ''
    },
    house: {
      id: Number(row.house_id),
      type: row.house_type,
      x: Number(row.house_x),
      z: Number(row.house_z)
    }
  };
}

app.post('/api/login', async (req, res) => {
  try {
    const username = String(req.body.username || '')
      .trim().replace(/^@/, '').toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/.test(username)) {
      return res.status(400).json({error: 'Username noto‘g‘ri'});
    }

    const result = await pool.query(
      'SELECT * FROM users ORDER BY sort_order NULLS LAST, house_id'
    );

    let rows = result.rows;
    let index = rows.findIndex(u => u.username === username);
    let user;

    if (index === -1) {
      index = rows.length;
      const pos = getHousePosition(index);

      const inserted = await pool.query(`
        INSERT INTO users
          (username, house_id, house_type, house_x, house_z,
           registered_at, display_name, bio, sort_order)
        VALUES ($1,$2,$3,$4,$5,NOW(),$1,'',$6)
        RETURNING *
      `, [username, Date.now(), 'one-floor', pos.x, pos.z, index + 1]);

      user = formatUser(inserted.rows[0]);
    } else {
      const old = rows[index];
      const pos = getHousePosition(index);

      const updated = await pool.query(`
        UPDATE users
        SET house_x=$2, house_z=$3,
            display_name=COALESCE(display_name, username),
            bio=COALESCE(bio, '')
        WHERE username=$1
        RETURNING *
      `, [username, pos.x, pos.z]);

      user = formatUser(updated.rows[0]);
    }

    res.json({success: true, user});
  } catch (e) {
    console.error(e);
    res.status(500).json({error: 'Server xatosi'});
  }
});

app.get('/api/houses', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM users ORDER BY sort_order NULLS LAST, house_id'
    );

    res.json(result.rows.map(row => ({
      username: row.username,
      house: {
        id: Number(row.house_id),
        type: row.house_type,
        x: Number(row.house_x),
        z: Number(row.house_z)
      }
    })));
  } catch (e) {
    console.error(e);
    res.status(500).json({error: 'Server xatosi'});
  }
});

app.get('/api/profile/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();
    const result = await pool.query(
      'SELECT * FROM users WHERE username=$1',
      [username]
    );

    if (!result.rows.length) {
      return res.status(404).json({error: 'Foydalanuvchi topilmadi'});
    }

    const user = formatUser(result.rows[0]);

    res.json({
      username: user.username,
      registeredAt: user.registeredAt,
      profile: user.profile
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({error: 'Server xatosi'});
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const username = String(req.body.username || '')
      .trim().replace(/^@/, '').toLowerCase();

    const displayName = String(req.body.displayName || '').trim();
    const bio = String(req.body.bio || '').trim();

    if (!/^[a-z0-9._]{1,30}$/.test(username)) {
      return res.status(400).json({error: 'Username noto‘g‘ri'});
    }

    if (displayName.length > 40 || bio.length > 160) {
      return res.status(400).json({error: 'Profil matni juda uzun'});
    }

    const result = await pool.query(`
      UPDATE users
      SET display_name=$2, bio=$3
      WHERE username=$1
      RETURNING display_name, bio
    `, [username, displayName || username, bio]);

    if (!result.rows.length) {
      return res.status(404).json({error: 'Foydalanuvchi topilmadi'});
    }

    res.json({
      success: true,
      profile: {
        displayName: result.rows[0].display_name,
        bio: result.rows[0].bio
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({error: 'Server xatosi'});
  }
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('UZB SHAHAR 3D server ishga tushdi!');
});
pool.query("SELECT NOW()")
  .then(res => console.log("NEON BAZA ISHLAYAPTI:", res.rows[0]))
  .catch(err => console.error("NEON XATOSI:", err.message));

// UZB ECONOMY DATABASE
async function initEconomy() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS economy (
      username TEXT PRIMARY KEY REFERENCES users(username),
      balance BIGINT NOT NULL DEFAULT 1000,
      bank BIGINT NOT NULL DEFAULT 0,
      last_gift DATE
    );

    CREATE TABLE IF NOT EXISTS economy_tasks (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username),
      task_date DATE NOT NULL DEFAULT CURRENT_DATE,
      task_type TEXT NOT NULL,
      reward INTEGER NOT NULL,
      UNIQUE(username, task_date, task_type)
    );

    CREATE TABLE IF NOT EXISTS economy_buildings (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username),
      building_type TEXT NOT NULL,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("UZB ECONOMY DATABASE READY!");
}


// UZB ECONOMY API

app.get('/api/economy/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase();

    await pool.query(
      `INSERT INTO economy (username)
       VALUES ($1) ON CONFLICT DO NOTHING`,
      [username]
    );

    const result = await pool.query(
      'SELECT * FROM economy WHERE username=$1',
      [username]
    );

    res.json({success:true, economy:result.rows[0]});
  } catch (e) {
    console.error(e);
    res.status(500).json({error:'Iqtisodiyot xatosi'});
  }
});


// MONEY TRANSFER API
app.post('/api/economy/earn', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();
    const amount = Number(req.body.amount);

    if (!/^[a-z0-9._]{1,30}$/.test(username) ||
        !Number.isSafeInteger(amount) || amount < 1 || amount > 10000) {
      return res.status(400).json({error:'Noto‘g‘ri ma’lumot'});
    }

    const result = await pool.query(`
      INSERT INTO economy (username, balance)
      VALUES ($1, 1000 + $2)
      ON CONFLICT (username)
      DO UPDATE SET balance = economy.balance + $2
      RETURNING balance, bank
    `, [username, amount]);

    res.json({success:true, economy:result.rows[0]});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Pul qo‘shishda xato'});
  }
});

// BANK API
app.post('/api/economy/bank', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();
    const amount = Number(req.body.amount);
    const action = req.body.action;

    if (!/^[a-z0-9._]{1,30}$/.test(username) ||
        !Number.isSafeInteger(amount) || amount < 1 ||
        !['deposit','withdraw'].includes(action)) {
      return res.status(400).json({error:'Noto‘g‘ri ma’lumot'});
    }

    const result = await pool.query(`
      UPDATE economy
      SET balance = balance + CASE WHEN $3='withdraw' THEN $2 ELSE -$2 END,
          bank = bank + CASE WHEN $3='deposit' THEN $2 ELSE -$2 END
      WHERE username=$1
      AND CASE WHEN $3='deposit' THEN balance >= $2 ELSE bank >= $2 END
      RETURNING balance, bank
    `, [username, amount, action]);

    if (!result.rows.length) {
      return res.status(400).json({error:'Mablag‘ yetarli emas'});
    }

    res.json({success:true, economy:result.rows[0]});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Bank xatosi'});
  }
});


// DAILY GIFT API
app.post('/api/economy/gift', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/.test(username))
      return res.status(400).json({error:'Username noto‘g‘ri'});

    const result = await pool.query(`
      INSERT INTO economy (username, balance, last_gift)
      VALUES ($1, 1200, CURRENT_DATE)
      ON CONFLICT (username) DO UPDATE
      SET balance = economy.balance + 200,
          last_gift = CURRENT_DATE
      WHERE economy.last_gift IS NULL
         OR economy.last_gift < CURRENT_DATE
      RETURNING balance
    `, [username]);

    if (!result.rows.length)
      return res.status(400).json({error:'Bugungi sovg‘a olingan'});

    res.json({success:true, reward:200, balance:result.rows[0].balance});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Sovg‘a xatosi'});
  }
});

// DAILY TASK API
app.post('/api/economy/task', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();
    const task = String(req.body.task || '');

    const tasks = {
      visit: 100,
      build: 300,
      explore: 150
    };

    if (!/^[a-z0-9._]{1,30}$/.test(username) || !tasks[task])
      return res.status(400).json({error:'Topshiriq noto‘g‘ri'});

    const result = await pool.query(`
      WITH reward AS (
        INSERT INTO economy_tasks (username, task_type, reward)
        VALUES ($1, $2, $3)
        ON CONFLICT (username, task_date, task_type) DO NOTHING
        RETURNING reward
      )
      UPDATE economy
      SET balance = balance + (SELECT reward FROM reward)
      WHERE username=$1 AND EXISTS (SELECT 1 FROM reward)
      RETURNING balance
    `, [username, task, tasks[task]]);

    if (!result.rows.length)
      return res.status(400).json({error:'Topshiriq bajarilgan yoki foydalanuvchi topilmadi'});

    res.json({success:true, reward:tasks[task], balance:result.rows[0].balance});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Topshiriq xatosi'});
  }
});


// BUILDING PURCHASE API
app.post('/api/economy/build', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();
    const type = String(req.body.type || '');

    const prices = {
      shop: 500,
      market: 1500,
      hotel: 5000
    };

    if (!/^[a-z0-9._]{1,30}$/.test(username) || !prices[type])
      return res.status(400).json({error:'Noto‘g‘ri ma’lumot'});

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const account = await client.query(
        'SELECT balance FROM economy WHERE username=$1 FOR UPDATE',
        [username]
      );

      if (!account.rows.length || Number(account.rows[0].balance) < prices[type]) {
        await client.query('ROLLBACK');
        return res.status(400).json({error:'Mablag‘ yetarli emas'});
      }

      await client.query(
        'UPDATE economy SET balance=balance-$2 WHERE username=$1',
        [username, prices[type]]
      );

      const building = await client.query(
        `INSERT INTO economy_buildings (username, building_type)
         VALUES ($1,$2) RETURNING *`,
        [username, type]
      );

      await client.query('COMMIT');

      res.json({success:true, building:building.rows[0]});
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Bino sotib olishda xato'});
  }
});

// BUILDING INCOME API
app.post('/api/economy/collect', async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase();

    if (!/^[a-z0-9._]{1,30}$/.test(username))
      return res.status(400).json({error:'Username noto‘g‘ri'});

    const income = {shop:50, market:150, hotel:400};

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const buildings = await client.query(
        'SELECT * FROM economy_buildings WHERE username=$1',
        [username]
      );

      const total = buildings.rows.reduce(
        (sum, b) => sum + (income[b.building_type] || 0) * Number(b.level),
        0
      );

      if (!total) {
        await client.query('ROLLBACK');
        return res.status(400).json({error:'Daromad beruvchi bino yo‘q'});
      }

      const account = await client.query(
        'UPDATE economy SET balance=balance+$2 WHERE username=$1 RETURNING balance',
        [username, total]
      );

      if (!account.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({error:'Hisob topilmadi'});
      }

      await client.query('COMMIT');

      res.json({success:true, income:total, balance:account.rows[0].balance});
    } catch(e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch(e) {
    console.error(e);
    res.status(500).json({error:'Daromad olishda xato'});
  }
});


initEconomy().catch(err =>
  console.error("ECONOMY INIT ERROR:", err)
);
