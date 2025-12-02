# MySQL schema — Banking Management System

Below is a complete, ready-to-run MySQL script that creates the database and tables based on your ERD. It uses **InnoDB**, `utf8mb4`, appropriate data types, foreign keys, indexes, and sensible constraints. I also combine `Officer` and `Manager` into a single `employees` table (with a `role`) to avoid duplication — this is standard practice; if you want separate tables I can change it.

Save as `bankdb_init.sql` and run with `mysql -u root -p < bankdb_init.sql` (or paste into your MySQL client).

---

```sql
-- bankdb_init.sql
-- Banking Management System schema
-- Run: mysql -u root -p < bankdb_init.sql

DROP DATABASE IF EXISTS bankdb;
CREATE DATABASE bankdb CHARACTER SET = 'utf8mb4' COLLATE = 'utf8mb4_general_ci';
USE bankdb;

-- ======================
-- Customers
-- ======================
CREATE TABLE customers (
  customer_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(150) NOT NULL,
  middle_name VARCHAR(150),
  last_name VARCHAR(150) NOT NULL,
  date_of_birth DATE,
  gender ENUM('male','female','other') DEFAULT 'other',
  email VARCHAR(255) UNIQUE,
  contact VARCHAR(40),
  pan VARCHAR(20) UNIQUE,               -- Permanent Account Number (PAN)
  nationality VARCHAR(100),
  salary DECIMAL(18,2) DEFAULT 0.00,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_contact ON customers(contact);

-- ======================
-- Interest table
-- ======================
CREATE TABLE interest_rates (
  interest_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  savings_rate DECIMAL(6,4) DEFAULT 0.00,  -- e.g. 0.0350 = 3.50%
  loan_rate DECIMAL(6,4) DEFAULT 0.00,
  rd_rate DECIMAL(6,4) DEFAULT 0.00,
  fd_rate DECIMAL(6,4) DEFAULT 0.00,
  current_interest DECIMAL(6,4) DEFAULT 0.00,
  effective_from DATE DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ======================
-- Accounts
-- ======================
CREATE TABLE accounts (
  account_no BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  account_type ENUM('savings','checking','current') DEFAULT 'savings',
  balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  interest_id INT UNSIGNED DEFAULT NULL,
  interest_amount DECIMAL(18,2) DEFAULT 0.00,
  interest_rate DECIMAL(6,4) DEFAULT 0.00,
  date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','suspended','closed') DEFAULT 'active',
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (interest_id) REFERENCES interest_rates(interest_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_accounts_status ON accounts(status);

-- ======================
-- Transactions (ledger)
-- ======================
CREATE TABLE transactions (
  transaction_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_no BIGINT UNSIGNED NOT NULL,
  related_account_no BIGINT UNSIGNED, -- used for transfers (other side)
  transaction_type ENUM('deposit','withdrawal','transfer','fee','interest','adjustment') NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  txn_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before_balance DECIMAL(18,2) NOT NULL,
  after_balance DECIMAL(18,2) NOT NULL,
  total_balance DECIMAL(18,2) GENERATED ALWAYS AS (after_balance) VIRTUAL,
  description VARCHAR(500),
  status ENUM('pending','completed','failed') DEFAULT 'completed',
  reference VARCHAR(120), -- idempotency/reference number
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_no) REFERENCES accounts(account_no) ON DELETE CASCADE,
  FOREIGN KEY (related_account_no) REFERENCES accounts(account_no) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_txn_account ON transactions(account_no);
CREATE INDEX idx_txn_reference ON transactions(reference);
CREATE INDEX idx_txn_date ON transactions(txn_date);

-- ======================
-- Deposit Accounts (Fixed deposit / recurring / special deposit)
-- ======================
CREATE TABLE deposit_accounts (
  deposit_account_no BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_no BIGINT UNSIGNED NOT NULL,     -- base/current account mapping (owner)
  closure_type ENUM('on_maturity','preclosure','auto_renew') DEFAULT 'on_maturity',
  interest_id INT UNSIGNED DEFAULT NULL,
  initial_amount DECIMAL(18,2) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  deposit_type ENUM('fd','rd','td','savings_deposit') DEFAULT 'fd',
  interest_amount DECIMAL(18,2) DEFAULT 0.00,
  current_balance DECIMAL(18,2) DEFAULT 0.00,
  duration_months INT DEFAULT 0,
  interest_rate DECIMAL(6,4) DEFAULT 0.00,
  open_date DATE DEFAULT CURRENT_DATE,
  close_date DATE,
  days INT DEFAULT 0,
  status ENUM('active','closed','premature_closed') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_no) REFERENCES accounts(account_no) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (interest_id) REFERENCES interest_rates(interest_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_deposit_account_acc ON deposit_accounts(account_no);
CREATE INDEX idx_deposit_account_customer ON deposit_accounts(customer_id);

-- ======================
-- Loan Accounts
-- ======================
CREATE TABLE loan_accounts (
  loan_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_no BIGINT UNSIGNED NOT NULL, -- optional mapping to accounts table
  loan_type VARCHAR(100) NOT NULL,
  date_of_loan DATE NOT NULL,
  duration_months INT NOT NULL,
  total_amount DECIMAL(18,2) NOT NULL,
  remaining_amount DECIMAL(18,2) NOT NULL,
  status ENUM('active','closed','defaulted','rescheduled') DEFAULT 'active',
  description VARCHAR(500),
  interest_rate DECIMAL(6,4) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_no) REFERENCES accounts(account_no) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_loan_account_acc ON loan_accounts(account_no);
CREATE INDEX idx_loan_status ON loan_accounts(status);

-- ======================
-- Beneficiaries (optional)
-- ======================
CREATE TABLE beneficiaries (
  beneficiary_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_customer_id BIGINT UNSIGNED NOT NULL,
  beneficiary_name VARCHAR(200) NOT NULL,
  beneficiary_account_no VARCHAR(64) NOT NULL,
  bank_name VARCHAR(200),
  ifsc VARCHAR(50),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified TINYINT(1) DEFAULT 0,
  FOREIGN KEY (user_customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ======================
-- Employees (Officer / Manager)
-- Merged table with role to avoid duplication.
-- If you want separate tables create 'officers' and 'managers' similarly.
-- ======================
CREATE TABLE employees (
  employee_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role ENUM('officer','manager','admin') NOT NULL DEFAULT 'officer',
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  nationality VARCHAR(100),
  salary DECIMAL(18,2) DEFAULT 0.00,
  address TEXT,
  gender ENUM('male','female','other') DEFAULT 'other',
  contact VARCHAR(40),
  date_of_birth DATE,
  first_name VARCHAR(150),
  middle_name VARCHAR(150),
  last_name VARCHAR(150),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_username ON employees(username);

-- ======================
-- Refresh tokens (for auth, store hashed tokens)
-- ======================
CREATE TABLE refresh_tokens (
  token_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_customer_id BIGINT UNSIGNED DEFAULT NULL,
  employee_id BIGINT UNSIGNED DEFAULT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_refresh_user ON refresh_tokens(user_customer_id);
CREATE INDEX idx_refresh_employee ON refresh_tokens(employee_id);

-- ======================
-- Audit logs
-- ======================
CREATE TABLE audit_logs (
  audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_customer_id BIGINT UNSIGNED,
  employee_id BIGINT UNSIGNED,
  action VARCHAR(150) NOT NULL,
  meta JSON,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_audit_user ON audit_logs(user_customer_id);
CREATE INDEX idx_audit_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- ======================
-- Sample seed data (minimal)
-- ======================
INSERT INTO interest_rates (savings_rate, loan_rate, rd_rate, fd_rate, current_interest, effective_from)
VALUES (0.0350, 0.0900, 0.0450, 0.0600, 0.0350, CURDATE());

INSERT INTO customers (first_name, last_name, date_of_birth, gender, email, contact, pan, nationality, salary, address)
VALUES ('Sanjay', 'Singh', '1990-01-01', 'male', 'sanjay@example.com', '9999999999', 'ABCDE1234F', 'Indian', 50000, 'Mumbai');

-- create a basic account for seeded customer
INSERT INTO accounts (customer_id, account_type, balance, interest_id, interest_rate)
VALUES (1, 'savings', 10000.00, 1, 0.0350);

-- sample deposit account (FD)
INSERT INTO deposit_accounts (account_no, interest_id, initial_amount, customer_id, deposit_type, interest_amount, current_balance, duration_months, interest_rate, open_date, close_date)
VALUES (1, 1, 50000.00, 1, 'fd', 3000.00, 53000.00, 12, 0.06, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH));

-- sample transaction for the account
INSERT INTO transactions (account_no, transaction_type, amount, before_balance, after_balance, description, status, reference)
VALUES (1, 'deposit', 10000.00, 0.00, 10000.00, 'Initial deposit', 'completed', 'INIT-1');

-- sample employee
INSERT INTO employees (role, username, password_hash, email, first_name, last_name)
VALUES ('manager', 'mgr1', '$2a$10$examplehashplaceholder...............', 'manager@example.com', 'Ramesh', 'Kumar');

-- ======================
-- Fin.
-- ======================
```

---

## Notes & suggestions

* Monetary columns use `DECIMAL(18,2)` — **do not** use floating point.
* For transfers implement **idempotency** using `transactions.reference` and database transactions (`SELECT ... FOR UPDATE`) to lock balances and avoid race conditions.
* `employees` merges Officer & Manager. If you strictly want separate tables `officers` & `managers`, tell me and I’ll provide that variant.
* Store **only hashed refresh tokens** (never plaintext).
* Consider adding `unique` constraints where appropriate (e.g., `account_number` if you adopt a string account format).
* Add more indexes based on query patterns (e.g., transactions by date range).
* Add partitions to `transactions` for very large volume systems.

---

If you want, I can:

* generate migration files (Flyway / Knex / Sequelize) or a SQL file packaged as a ZIP,
* produce sample Node.js services for transfers (safe with transactions + `FOR UPDATE`), or
* create ER diagram visuals (SVG/PNG). Which next?
