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
