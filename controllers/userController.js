import { getAllUsers, getUserById } from '../services/user.service.js';

export async function listUsers(req, res) {
  try {
    const rows = await getAllUsers();
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

export async function profile(req, res) {
  try {
    const id = req.user?.id;
    if (!id) return res.status(400).json({ success: false, message: 'User id missing' });
    const user = await getUserById(id);
    res.json({ success: true, data: user,is_profiler:true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}