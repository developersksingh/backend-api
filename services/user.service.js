import pool from '../config/db.js';

export async function getAllUsers() {
  const [rows] = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id DESC');
  return rows;
}

export async function getUserById(id) {
  const [rows] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}