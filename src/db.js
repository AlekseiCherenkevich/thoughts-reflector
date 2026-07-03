const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS users (
        telegram_id BIGINT PRIMARY KEY,
        username TEXT,
        last_active_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        summary TEXT
      );
    `);
    console.log('Database tables created/verified');
  } finally {
    client.release();
  }
}

async function saveMessage(chatId, role, content) {
  const client = await pool.connect();
  try {
    await client.query(
      'INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)',
      [chatId, role, content]
    );
  } finally {
    client.release();
  }
}

async function getMessages(chatId, limit = 20) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [chatId, limit]
    );
    return res.rows.reverse();
  } finally {
    client.release();
  }
}

async function clearMessages(chatId) {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
  } finally {
    client.release();
  }
}

async function getUser(telegramId) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    return res.rows[0];
  } finally {
    client.release();
  }
}

async function upsertUser(telegramId, username, isActive = true) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO users (telegram_id, username, last_active_at, is_active)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (telegram_id) DO UPDATE SET
         username = $2,
         last_active_at = NOW(),
         is_active = $3`,
      [telegramId, username, isActive]
    );
  } finally {
    client.release();
  }
}

async function updateUserSummary(telegramId, summary) {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET summary = $1 WHERE telegram_id = $2',
      [summary, telegramId]
    );
  } finally {
    client.release();
  }
}

async function getMessagesCount(chatId) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      'SELECT COUNT(*) FROM messages WHERE chat_id = $1',
      [chatId]
    );
    return parseInt(res.rows[0].count);
  } finally {
    client.release();
  }
}

module.exports = {
  initDB,
  saveMessage,
  getMessages,
  clearMessages,
  getUser,
  upsertUser,
  updateUserSummary,
  getMessagesCount
};