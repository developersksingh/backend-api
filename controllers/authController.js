import { registerUser, loginUser } from '../services/auth.service.js';

export async function register(req, res) {
  try {
    const result = await registerUser(req.body);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function login(req, res) {
  try {
    const result = await loginUser(req.body);
    if (result.error) return res.status(400).json({ success: false, message: result.error });
    res.json({ success: true, token: result.token, user: result.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}