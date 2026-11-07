const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
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
