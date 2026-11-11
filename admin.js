const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');

module.exports = function(pool) {
  const router = express.Router();
  const attempts = new Map();

  function tokenFor(username) {
    const payload = Buffer.from(JSON.stringify({
      username,
      expires: Date.now() + 8 * 60 * 60 * 1000
    })).toString('base64url');

    const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET)
      .update(payload).digest('base64url');

    return payload + '.' + sig;
  }

  function isAdmin(req) {
    const match = (req.headers.cookie || '').match(/(?:^|;\s*)admin_session=([^;]+)/);
    if (!match || !process.env.SESSION_SECRET) return false;

    const parts = match[1].split('.');
    if (parts.length !== 2) return false;

    const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET)
      .update(parts[0]).digest('base64url');

    const a = Buffer.from(parts[1]);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    try {
      const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      return data.username === process.env.ADMIN_USERNAME && data.expires > Date.now();
    } catch {
      return false;
    }
  }

  function protect(req, res, next) {
    if (!isAdmin(req)) return res.status(401).json({error: 'Admin sifatida kiring'});
    next();
  }

  router.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
  });

  router.post('/api/admin/login', async (req, res) => {
    try {
      const ip = req.ip || 'unknown';
      const now = Date.now();
      let attempt = attempts.get(ip) || {count: 0, until: now + 900000};

      if (now > attempt.until) attempt = {count: 0, until: now + 900000};
      if (attempt.count >= 8) {
        return res.status(429).json({error: '15 daqiqadan keyin urinib ko‘ring'});
      }

      const username = String(req.body.username || '').trim();
      const password = String(req.body.password || '');
      const validUser = username.toLowerCase() ===
        String(process.env.ADMIN_USERNAME || '').toLowerCase();
      const validPassword = process.env.ADMIN_PASSWORD_HASH
        ? await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
        : false;

      if (!validUser || !validPassword) {
        attempt.count++;
        attempts.set(ip, attempt);
        return res.status(401).json({error: 'Login yoki parol noto‘g‘ri'});
      }

      attempts.delete(ip);
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie',
        'admin_session=' + tokenFor(process.env.ADMIN_USERNAME) +
        '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800' + secure
      );
      res.json({success: true});
    } catch (err) {
      console.error('Admin login:', err.message);
      res.status(500).json({error: 'Server xatosi'});
    }
  });

  router.post('/api/admin/logout', (req, res) => {
    res.setHeader('Set-Cookie',
      'admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({success: true});
  });

  router.get('/api/admin/me', protect, (req, res) => {
    res.json({success: true, username: process.env.ADMIN_USERNAME});
  });

  router.get('/api/admin/users', protect, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT username, house_id, house_type, display_name, bio FROM users ORDER BY sort_order NULLS LAST, house_id'
      );
      res.json({total: result.rows.length, users: result.rows});
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Ro‘yxatni olishda xato'});
    }
  });

  router.patch('/api/admin/users/:username', protect, async (req, res) => {
    try {
      const username = String(req.params.username || '').toLowerCase();
      const name = String(req.body.displayName || '').trim();
      const bio = String(req.body.bio || '').trim();
      const type = String(req.body.houseType || '');

      if (name.length > 40 || bio.length > 160 ||
          !/^[a-z0-9-]{1,30}$/.test(type)) {
        return res.status(400).json({error: 'Kiritilgan ma’lumot noto‘g‘ri'});
      }

      const result = await pool.query(
        'UPDATE users SET display_name=$1, bio=$2, house_type=$3 WHERE username=$4 RETURNING username, display_name, bio, house_type',
        [name || username, bio, type, username]
      );

      if (!result.rows.length) return res.status(404).json({error: 'Foydalanuvchi topilmadi'});
      res.json({success: true, user: result.rows[0]});
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Saqlashda xato'});
    }
  });

  return router;
};
