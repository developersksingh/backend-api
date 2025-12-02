Create a project for Node **24.11.x** (ESM) + MySQL + **JWT auth** + Swagger + services/middleware.
run `npm install`, create the DB table, then `npm run start` (or `npm run dev`).

---

# Project structure

```
node-mysql-jwt-api/
├─ package.json
├─ .env
├─ server.js
├─ swagger.js
├─ config/
│  └─ db.js
├─ utils/
│  └─ token.js
├─ controllers/
│  ├─ authController.js
│  └─ userController.js
├─ services/
│  ├─ auth.service.js
│  └─ user.service.js
├─ middlewares/
│  └─ auth.middleware.js
├─ routes/
│  ├─ auth.routes.js
│  └─ user.routes.js
└─ sql/
   └─ init.sql
```

---

## package.json

```json
{
  "name": "node-mysql-jwt-api",
  "version": "1.0.0",
  "description": "Node.js API with MySQL, JWT authentication and Swagger (ESM)",
  "type": "module",
  "engines": { "node": ">=24.11.0", "npm": ">=11.6.1" },
  "scripts": { "start": "node server.js", "dev": "node --watch server.js" },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.10.0",
    "swagger-jsdoc": "^6.2.8",
    "swagger-ui-express": "^4.6.3"
  }
}
```

---

## .env (example)

```
PORT=5000
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=1d
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=testdb
```

---

## server.js

```js
import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import { swaggerServe, swaggerSetup } from './swagger.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Swagger UI
app.use('/api-docs', swaggerServe, swaggerSetup);

// basic health
app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});
```

---

## swagger.js

```js
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Node MySQL JWT API',
      version: '1.0.0',
      description: 'Example API with JWT auth'
    },
    servers: [{ url: `http://localhost:${process.env.PORT || 5000}` }]
  },
  apis: ['./routes/*.js'] // files containing annotations
};

const swaggerSpec = swaggerJsdoc(options);

export const swaggerSetup = swaggerUi.setup(swaggerSpec);
export const swaggerServe = swaggerUi.serve;
```

---

## config/db.js

```js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'testdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
```

---

## utils/token.js

```js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '1d'
  });
}
```

---

## services/auth.service.js

```js
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
```

---

## services/user.service.js

```js
import pool from '../config/db.js';

export async function getAllUsers() {
  const [rows] = await pool.query('SELECT id, name, email, created_at FROM users ORDER BY id DESC');
  return rows;
}

export async function getUserById(id) {
  const [rows] = await pool.query('SELECT id, name, email, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}
```

---

## controllers/authController.js

```js
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
```

---

## controllers/userController.js

```js
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
    res.json({ success: true, data: user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
```

---

## middlewares/auth.middleware.js

```js
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

export default function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
```

---

## routes/auth.routes.js

```js
import express from 'express';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: created
 */
router.post('/register', register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: ok
 */
router.post('/login', login);

export default router;
```

---

## routes/user.routes.js

```js
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
```

---

## sql/init.sql

```sql
CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Quick setup & run

1. Create project folder and paste files with the structure above.
2. Put your DB credentials in `.env`.
3. Run in project folder:

   ```bash
   npm install
   # create DB + table:
   mysql -u root -p < sql/init.sql
   # start:
   npm run start
   ```
4. Visit:

   * Health: `GET http://localhost:5000/health`
   * Swagger: `http://localhost:5000/api-docs`
   * Register: `POST http://localhost:5000/api/auth/register` with JSON `{ "name":"S", "email":"a@b.com","password":"pass" }`
   * Login: `POST http://localhost:5000/api/auth/login` -> returns token
   * Protected: `GET http://localhost:5000/api/users` with header `Authorization: Bearer <token>`
-----------------------------------------------------------------------------------------------------------------------
{
  "name": "Sanjay Singh",
  "email": "sanjay@gmail.com",
  "password": "speedx@123#"
}

