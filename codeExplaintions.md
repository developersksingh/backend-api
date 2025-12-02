# Step-by-step explanation of the project (what each file does and how the flow works)

I'll walk through the project top-to-bottom so you understand how requests travel, where data is stored, and which parts are responsible for JWT auth, DB access and Swagger docs.

---

## 1) `package.json`

* Declares the project as an **ESM** project (`"type": "module"`) so we use `import` / `export`.
* Lists runtime versions in `engines` (helpful for deployment).
* Has `start` and `dev` scripts. `dev` uses `node --watch` to auto-restart on file changes.
* Lists runtime dependencies: `express`, `mysql2` (promise API), `jsonwebtoken`, `bcryptjs`, `dotenv`, and Swagger libs.

**Why important:** tells npm which packages to install and how to run the app.

---

## 2) `.env`

Holds environment-specific values:

```
PORT=5000
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=1d
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=testdb
```

* `JWT_SECRET`: symmetric key for signing/verifying JWTs — **keep secret**.
* `JWT_EXPIRE`: token lifetime (e.g. `1d`, `2h`).
* DB credentials used by the connection pool.

**Why important:** keeps secrets/config out of source code.

---

## 3) `server.js` — app entry point

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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api-docs', swaggerServe, swaggerSetup);

app.get('/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api-docs`);
});
```

* Loads environment variables with `dotenv`.
* Registers `express.json()` (no body-parser needed).
* Mounts route modules:

  * `/api/auth` — registration & login.
  * `/api/users` — protected users endpoints.
* Mounts Swagger UI at `/api-docs`.
* Starts server.

**Request flow:** Incoming HTTP → Express routing → matching route handler (controller).

---

## 4) `swagger.js` — Swagger/OpenAPI setup

* Uses `swagger-jsdoc` to read JSDoc `@openapi` comments from `./routes/*.js`.
* Exports `swaggerSpec` used by `swagger-ui-express` to serve interactive docs at `/api-docs`.

**Why:** gives you auto-generated API documentation and an interactive UI to try endpoints.

---

## 5) `config/db.js` — MySQL connection pool

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

* Creates a pool of MySQL connections using `mysql2/promise`.
* Use `pool.query()` or `pool.execute()` throughout services.

**Why:** efficient DB access and safe to reuse in concurrent requests.

---

## 6) `utils/token.js` — JWT generator

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

* `payload` is typically `{ id, email }`.
* Returns a signed JWT string.

**Why:** centralises token creation so it’s consistent across services.

---

## 7) `services/auth.service.js` — auth business logic

Key functions:

* `registerUser({ name, email, password })`

  * Validates presence of fields.
  * Checks if email exists via `SELECT`.
  * Hashes password with `bcrypt.hash(password, 10)`.
  * Inserts row: `INSERT INTO users (name, email, password)`.
  * Returns inserted id and user data (without password).
* `loginUser({ email, password })`

  * Fetch user by email.
  * Compare supplied password with stored hash using `bcrypt.compare`.
  * If OK, generate JWT with `generateToken({ id, email })`.
  * Return `{ token, user }`.

**Why separation:** services contain database and business logic; controllers remain thin.

---

## 8) `services/user.service.js`

* `getAllUsers()` — returns list of users (id, name, email, created_at).
* `getUserById(id)` — returns single user.

**Why:** separates read operations from controllers. Use services in controllers.

---

## 9) `controllers/authController.js` — HTTP handlers for auth

* `register(req, res)`:

  * Calls `registerUser(req.body)`.
  * If error returned, respond 400; otherwise 201 with created data.
* `login(req, res)`:

  * Calls `loginUser(req.body)`.
  * On success returns `{ token, user }`.

**Why:** controllers convert HTTP requests into service calls and produce HTTP responses.

---

## 10) `controllers/userController.js` — HTTP handlers for users

* `listUsers(req, res)` — calls `getAllUsers()` and returns JSON.
* `profile(req, res)` — reads `req.user.id` (set by auth middleware) and returns current user details.

**Why:** controller endpoints for protected user actions.

---

## 11) `middlewares/auth.middleware.js` — JWT verification

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
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}
```

* Checks `Authorization` header format `Bearer <token>`.
* Verifies token using `jwt.verify()` and the `JWT_SECRET`.
* Attaches decoded payload to `req.user` for use in controllers.

**Why:** protects routes; centralised token checking and error handling.

---

## 12) `routes/*.js` — wiring endpoints to controllers

* `routes/auth.routes.js` exposes:

  * `POST /api/auth/register` → controller.register
  * `POST /api/auth/login` → controller.login
* `routes/user.routes.js` exposes protected user endpoints:

  * `GET /api/users` → authMiddleware → listUsers
  * `GET /api/users/profile` → authMiddleware → profile

Each route file also has `@openapi` annotations so Swagger documents them.

---

## 13) `sql/init.sql`

Creates database and `users` table:

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

**Why:** database schema to run example.

---

## Full request flow (example: login -> access protected route)

1. **Register**

   * Client `POST /api/auth/register` with `{name,email,password}`.
   * `authController.register` calls `registerUser()`.
   * `services` inserts user with hashed password.
   * Response: `201 { success: true, data: { id, name, email } }`.

2. **Login**

   * Client `POST /api/auth/login` with `{email,password}`.
   * `authController.login` calls `loginUser()`.
   * `loginUser()` validates password and creates a JWT: `token`.
   * Response: `{ success: true, token: "...", user: {...} }`.

3. **Call protected route**

   * Client sends `GET /api/users` with header:

     ```
     Authorization: Bearer <token>
     ```
   * `auth.middleware` verifies token and sets `req.user = { id, email, iat, exp }`.
   * Controller uses `req.user.id` and responds with data.

---

## Example `curl` commands

Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Sanjay","email":"sanjay@example.com","password":"123456"}'
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"sanjay@example.com","password":"123456"}'
```

Use token for protected route:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/users
```

---

## Security notes & best practices

* **Never** commit `.env` or real `JWT_SECRET` to source control.
* Use a **strong, randomly generated** `JWT_SECRET` (32+ bytes).
* Consider **HTTPS** in production and set token cookies with `secure` and `httpOnly` flags (if using cookies).
* Consider **refresh tokens** for long sessions (store refresh tokens securely).
* Hashing: `bcrypt` with cost `10` is fine for small apps; increase cost for higher security/time tradeoff.
* Protect against brute-force / enumeration: rate-limit login attempts and implement account lockout if needed.
* Validate & sanitize inputs (use a library like `Joi` or `express-validator`) before DB calls to avoid malformed input.
* Use parameterized queries (we do) to avoid SQL injection.

---

## Troubleshooting & debugging

* If `ReferenceError: require is not defined` → ensure `"type": "module"` in `package.json` and all files use `import`.
* DB connection errors: verify `.env` values and that MySQL is running; test with MySQL CLI.
* `Invalid token` errors: check `JWT_SECRET` used to sign and verify tokens are identical.
* For unhelpful errors — add logging in `catch` blocks or temporarily `console.log(err)` to inspect.

---

## Suggested next steps (if you want to expand)

* Add **request validation** (Joi/express-validator).
* Add **refresh token** flow.
* Add **role-based access** (admin vs user).
* Add **rate limiting** (express-rate-limit) for auth endpoints.
* Add **unit/integration tests** (Jest + supertest).
* Dockerize (Dockerfile + docker-compose with MySQL).

---
