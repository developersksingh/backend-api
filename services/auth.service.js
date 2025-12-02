import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateToken } from '../utils/token.js';

export async function registerUser({ name, email, password }) {
  if (!name || !email || !password) return { error: 'name, email, password required' };

  // check exists
  const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) return { error: 'Email already registered' };

  const hashed = await bcrypt.hash(password, 10);
  const [result] = await pool.execute(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashed]
  );
  return { id: result.insertId, name, email };
}

export async function loginUser({ email, password }) {
  if (!email || !password) return { error: 'email and password required' };

  const [rows] = await pool.query('SELECT id, name, email, password FROM users WHERE email = ?', [email]);
  if (rows.length === 0) return { error: 'Invalid credentials' };

  const user = rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return { error: 'Invalid credentials' };

  const token = generateToken({ id: user.id, email: user.email });
  return { token, user: { id: user.id, name: user.name, email: user.email } };
}