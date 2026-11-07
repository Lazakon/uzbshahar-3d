app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, {recursive:true});
const DB = path.join(DATA_DIR, 'users.json');

function readDB() {
  return JSON.parse(fs.readFileSync(DB, 'utf8'));
}

function saveDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

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

app.post('/api/login', (req, res) => {
  const username = String(req.body.username || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  if (!/^[a-z0-9._]{1,30}$/.test(username)) {
    return res.status(400).json({error: 'Username noto‘g‘ri'});
  }

  const db = readDB();

  db.users.forEach((u, i) => {
    const pos = getHousePosition(i);
    u.house.x = pos.x;
    u.house.z = pos.z;

    if (!u.registeredAt) u.registeredAt = new Date().toISOString();
    if (!u.profile) {
      u.profile = {displayName: u.username, bio: ''};
    }
  });

  let user = db.users.find(u => u.username === username);

  if (!user) {
    user = {
      username,
      registeredAt: new Date().toISOString(),
      profile: {
        displayName: username,
        bio: ''
      },
      house: {
        id: Date.now(),
        type: 'one-floor',
        ...getHousePosition(db.users.length)
      }
    };

    db.users.push(user);
  } else {
    if (!user.registeredAt) {
      user.registeredAt = new Date().toISOString();
    }

    if (!user.profile) {
      user.profile = {
        displayName: username,
        bio: ''
      };
    }
  }

  saveDB(db);
  res.json({success: true, user});
});

// Barcha uylar
app.get('/api/houses', (req, res) => {
  const db = readDB();

  res.json(db.users.map(u => ({
    username: u.username,
    house: u.house
  })));
});

// Profilni ko‘rish
app.get('/api/profile/:username', (req, res) => {
  const db = readDB();
  const username = req.params.username.toLowerCase();
  const user = db.users.find(u => u.username === username);

  if (!user) {
    return res.status(404).json({error: 'Foydalanuvchi topilmadi'});
  }

  res.json({
    username: user.username,
    registeredAt: user.registeredAt,
    profile: user.profile
  });
});

// Profilni yangilash
app.put('/api/profile', (req, res) => {
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

  const db = readDB();
  const user = db.users.find(u => u.username === username);

  if (!user) {
    return res.status(404).json({error: 'Foydalanuvchi topilmadi'});
  }

  user.profile = {
    displayName: displayName || username,
    bio
  };

  saveDB(db);

  res.json({success: true, profile: user.profile});
});

app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log('UZB SHAHAR 3D: http://localhost:3000');
});
require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
