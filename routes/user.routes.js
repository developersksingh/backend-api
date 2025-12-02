import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { listUsers, profile } from '../controllers/userController.js';

const router = express.Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: list users
 */
router.get('/', authMiddleware, listUsers);

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: current user profile
 */
router.get('/profile', authMiddleware, profile);

export default router;