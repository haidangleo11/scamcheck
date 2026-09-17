const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.FORUM_JWT_SECRET;
const ADMIN_EMAIL = String(process.env.FORUM_ADMIN_EMAIL || '').trim().toLowerCase();
const ORIGINS = String(process.env.CORS_ORIGINS || 'https://scamcheck-azure.vercel.app,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!DATABASE_URL) throw new Error('DATABASE_URL is required. Connect this service to Railway PostgreSQL.');
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('FORUM_JWT_SECRET must contain at least 32 characters.');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000
});

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed.'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86_400
}));
app.use(express.json({ limit: '24kb' }));

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX = 10;
const WRITE_WINDOW_MS = 60 * 60 * 1000;
const WRITE_MAX = 30;
const buckets = new Map();

function rateLimit(prefix, windowMs, limit) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${prefix}:${req.ip}`;
    const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    buckets.set(key, current);
    if (current.count > limit) {
      res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    return next();
  };
}

function cleanText(value, max) {
  return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
}

function publicUser(row) {
  return { id: row.id, displayName: row.display_name, role: row.role };
}

function createToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, displayName: user.display_name }, JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'scamcheck-forum'
  });
}

function requireAuth(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Please sign in to use the Forum.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'scamcheck-forum' });
    req.auth = { id: payload.sub, role: payload.role, displayName: payload.displayName };
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Your Forum session has expired. Please sign in again.' });
  }
}

function requireModerator(req, res, next) {
  if (req.auth?.role !== 'moderator') return res.status(403).json({ error: 'Moderator access is required.' });
  return next();
}

async function initializeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name VARCHAR(30) NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS posts (
      id UUID PRIMARY KEY,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(32) NOT NULL CHECK (category IN ('safety', 'question', 'scam-alert', 'discussion')),
      title VARCHAR(140) NOT NULL,
      body VARCHAR(4000) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS posts_visible_created_idx ON posts (status, created_at DESC);
    CREATE TABLE IF NOT EXISTS replies (
      id UUID PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body VARCHAR(2000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS replies_post_created_idx ON replies (post_id, created_at ASC);
    CREATE TABLE IF NOT EXISTS post_reports (
      id UUID PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(300) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (post_id, reporter_id)
    );
  `);
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true, service: 'scamcheck-forum-api' });
  } catch (_) {
    return res.status(503).json({ ok: false, service: 'scamcheck-forum-api' });
  }
});

app.post('/api/auth/register', rateLimit('register', AUTH_WINDOW_MS, AUTH_MAX), async (req, res, next) => {
  try {
    const email = cleanText(req.body?.email, 254).toLowerCase();
    const displayName = cleanText(req.body?.displayName, 30);
    const password = String(req.body?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (displayName.length < 2) return res.status(400).json({ error: 'Display name must contain 2–30 characters.' });
    if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Password must contain 10–128 characters.' });
    const passwordHash = await bcrypt.hash(password, 12);
    const role = ADMIN_EMAIL && email === ADMIN_EMAIL ? 'moderator' : 'member';
    const insert = await pool.query(
      'INSERT INTO users (id, email, display_name, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, display_name, role',
      [crypto.randomUUID(), email, displayName, passwordHash, role]
    );
    const user = insert.rows[0];
    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'This email already has a Forum account. Please sign in instead.' });
    return next(error);
  }
});

app.post('/api/auth/login', rateLimit('login', AUTH_WINDOW_MS, AUTH_MAX), async (req, res, next) => {
  try {
    const email = cleanText(req.body?.email, 254).toLowerCase();
    const password = String(req.body?.password || '');
    const result = await pool.query('SELECT id, display_name, password_hash, role FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' });
    }
    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/auth/me', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, display_name, role FROM users WHERE id = $1', [req.auth.id]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Your Forum account is unavailable.' });
    return res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/posts', requireAuth, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.id, p.category, p.title, p.body, p.created_at,
             u.display_name AS author_name,
             COUNT(r.id)::int AS reply_count
      FROM posts p
      JOIN users u ON u.id = p.author_id
      LEFT JOIN replies r ON r.post_id = p.id
      WHERE p.status = 'published'
      GROUP BY p.id, u.display_name
      ORDER BY p.created_at DESC
      LIMIT 100
    `);
    return res.json({ posts: result.rows.map((row) => ({
      id: row.id, category: row.category, title: row.title, body: row.body,
      authorName: row.author_name, replyCount: row.reply_count, createdAt: row.created_at
    })) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/posts', requireAuth, rateLimit('post', WRITE_WINDOW_MS, WRITE_MAX), async (req, res, next) => {
  try {
    const category = cleanText(req.body?.category, 32);
    const title = cleanText(req.body?.title, 140);
    const body = cleanText(req.body?.body, 4000);
    if (!['safety', 'question', 'scam-alert', 'discussion'].includes(category)) return res.status(400).json({ error: 'Choose a valid category.' });
    if (title.length < 8) return res.status(400).json({ error: 'Title must contain 8–140 characters.' });
    if (body.length < 20) return res.status(400).json({ error: 'Post content must contain 20–4,000 characters.' });
    const result = await pool.query(
      `INSERT INTO posts (id, author_id, category, title, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, category, title, body, created_at`,
      [crypto.randomUUID(), req.auth.id, category, title, body]
    );
    const post = result.rows[0];
    return res.status(201).json({ post: {
      id: post.id, category: post.category, title: post.title, body: post.body,
      authorName: req.auth.displayName, replyCount: 0, createdAt: post.created_at
    } });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/posts/:postId/replies', requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.body, r.created_at, u.display_name AS author_name
      FROM replies r JOIN users u ON u.id = r.author_id
      WHERE r.post_id = $1
      ORDER BY r.created_at ASC
    `, [req.params.postId]);
    return res.json({ replies: result.rows.map((row) => ({
      id: row.id, body: row.body, authorName: row.author_name, createdAt: row.created_at
    })) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/posts/:postId/replies', requireAuth, rateLimit('reply', WRITE_WINDOW_MS, WRITE_MAX), async (req, res, next) => {
  try {
    const body = cleanText(req.body?.body, 2000);
    if (body.length < 2) return res.status(400).json({ error: 'Reply must contain 2–2,000 characters.' });
    const post = await pool.query('SELECT id FROM posts WHERE id = $1 AND status = $2', [req.params.postId, 'published']);
    if (!post.rows[0]) return res.status(404).json({ error: 'This Forum post is no longer available.' });
    const result = await pool.query(
      'INSERT INTO replies (id, post_id, author_id, body) VALUES ($1, $2, $3, $4) RETURNING id, body, created_at',
      [crypto.randomUUID(), req.params.postId, req.auth.id, body]
    );
    const reply = result.rows[0];
    return res.status(201).json({ reply: { id: reply.id, body: reply.body, authorName: req.auth.displayName, createdAt: reply.created_at } });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/posts/:postId/reports', requireAuth, rateLimit('report', WRITE_WINDOW_MS, WRITE_MAX), async (req, res, next) => {
  try {
    const reason = cleanText(req.body?.reason, 300) || 'Potentially unsafe or inappropriate Forum content.';
    const post = await pool.query('SELECT id FROM posts WHERE id = $1 AND status = $2', [req.params.postId, 'published']);
    if (!post.rows[0]) return res.status(404).json({ error: 'This Forum post is no longer available.' });
    await pool.query(
      'INSERT INTO post_reports (id, post_id, reporter_id, reason) VALUES ($1, $2, $3, $4)',
      [crypto.randomUUID(), req.params.postId, req.auth.id, reason]
    );
    return res.status(201).json({ ok: true });
  } catch (error) {
    if (error?.code === '23505') return res.status(409).json({ error: 'You have already reported this post.' });
    return next(error);
  }
});

app.get('/api/mod/reports', requireAuth, requireModerator, async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.reason, pr.created_at, p.id AS post_id, p.title, p.body,
             reporter.display_name AS reporter_name, author.display_name AS author_name
      FROM post_reports pr
      JOIN posts p ON p.id = pr.post_id
      JOIN users reporter ON reporter.id = pr.reporter_id
      JOIN users author ON author.id = p.author_id
      WHERE p.status = 'published'
      ORDER BY pr.created_at DESC
      LIMIT 100
    `);
    return res.json({ reports: result.rows.map((row) => ({
      id: row.id, postId: row.post_id, title: row.title, body: row.body, reason: row.reason,
      reporterName: row.reporter_name, authorName: row.author_name, createdAt: row.created_at
    })) });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/mod/posts/:postId/hide', requireAuth, requireModerator, async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE posts SET status = $1 WHERE id = $2 AND status = $3 RETURNING id', ['hidden', req.params.postId, 'published']);
    if (!result.rows[0]) return res.status(404).json({ error: 'This post is no longer available.' });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error?.message === 'Origin is not allowed.') return res.status(403).json({ error: 'This website origin is not allowed to access the Forum.' });
  console.error('Forum API error:', error);
  return res.status(500).json({ error: 'The Forum is temporarily unavailable. Please try again shortly.' });
});

initializeSchema()
  .then(() => app.listen(PORT, () => console.log(`ScamCheck Forum API listening on ${PORT}`)))
  .catch((error) => {
    console.error('Could not initialise Forum database:', error);
    process.exit(1);
  });
