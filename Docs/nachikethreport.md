---
author: Nachiketh
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report — OWASP A01 & A09

## A01 — Broken Access Control

Broken Access Control is the most prevalent category in the OWASP Top 10 2021. It occurs when an application does not properly enforce restrictions on what authenticated (or unauthenticated) users are allowed to do. In this codebase, the vast majority of API endpoints lack any authentication or authorisation checks whatsoever, allowing any user — or even completely unauthenticated visitors — to perform privileged operations.

---

### Detailed Finding 1: Missing Authentication on Administrative Endpoints

**Type of Flaw:** Missing Authentication & Authorisation — no `verifyToken` middleware on any data-modifying endpoint, and no role-based access control (RBAC) check anywhere in the application.

**Identify Code Snippet Exposing the Vulnerability:**

The backend controller (`controller/app.js`) defines numerous endpoints that handle sensitive operations. Nearly all of them are registered **without** the `verifyToken` middleware. Only one endpoint uses it — `/CheckRole` — and even that endpoint does not enforce role restrictions.

Below are the vulnerable code sections from `controller/app.js`, the changes applied, and the resulting new code.

**1. GET /users (original lines 219–241) — No auth, exposes all user data**

*Vulnerable code:*
```javascript
app.get('/users', function (req, res) {
    userDB.getUser(function (err, results) {
        if (err) { /* ... */ }
        else { res.send(results); }
    });
});
```

![GET /users vulnerable code](../Assets/Nachiketh/code/controller_app.js-_216-241.png)

*Fixed code — `verifyToken` and `requireAdmin` added:*
```javascript
app.get('/users', verifyToken, requireAdmin, function (req, res) {
    userDB.getUser(function (err, results) {
        if (err) { /* ... */ }
        else { res.send(results); }
    });
});
```

**2. POST /users (original lines 244–302) — No auth, client-supplied role**

*Vulnerable code:*
```javascript
app.post('/users', function (req, res) {
    var type = req.body.type;   // client can set ANY role
    userDB.insertUser(username, email, password, type, ...);
});
```

![POST /users vulnerable code](../Assets/Nachiketh/code/controller_app.js-_244-302.png)

*Fixed code — `verifyToken` + `requireAdmin` added, `type` hardcoded to `'user'`:*
```javascript
app.post('/users', verifyToken, requireAdmin, function (req, res) {
    var type = 'user';            // never trust client input
    userDB.insertUser(username, email, password, type, ...);
});
```

**3. GET /users/:userid (original lines 305–331) — No auth, IDOR**

*Vulnerable code:*
```javascript
app.get('/users/:userid', function (req, res) {
    userDB.getUserByUserid(userid, ...);
});
```

![GET /users/:userid vulnerable code](../Assets/Nachiketh/code/controller_app.js-_305-331.png)

*Fixed code:*
```javascript
app.get('/users/:userid', verifyToken, requireAdmin, function (req, res) {
    userDB.getUserByUserid(userid, ...);
});
```

**4. POST /category (original lines 334–381) — No auth**

*Vulnerable code:*
```javascript
app.post('/category', function (req, res) {
    categoryDB.insertCategory(catname, cat_description, ...);
});
```

![POST /category vulnerable code](../Assets/Nachiketh/code/controller_app.js-_334-381.png)

*Fixed code:*
```javascript
app.post('/category', verifyToken, requireAdmin, function (req, res) {
    categoryDB.insertCategory(catname, cat_description, ...);
});
```

**5. POST /platform (original lines 384–429) — No auth**

*Vulnerable code:*
```javascript
app.post('/platform', function (req, res) {
    platformDB.insertPlatform(platform_name, platform_description, ...);
});
```

![POST /platform vulnerable code](../Assets/Nachiketh/code/controller_app.js-_384-429.png)

*Fixed code:*
```javascript
app.post('/platform', verifyToken, requireAdmin, function (req, res) {
    platformDB.insertPlatform(platform_name, platform_description, ...);
});
```

**6. POST /game (original lines 432–495) — No auth**

*Vulnerable code:*
```javascript
app.post('/game', upload.single('game_image'), function (req, res) {
    gameDB.insertGame(title, game_description, year, game_image, ...);
});
```

![POST /game vulnerable code](../Assets/Nachiketh/code/controller_app.js-_432-495.png)

*Fixed code — `requireAdmin` added before `upload`:*
```javascript
app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function (req, res) {
    gameDB.insertGame(title, game_description, year, game_image, ...);
});
```

**7. DELETE /game/:id (original lines 526–551) — No auth**

*Vulnerable code:*
```javascript
app.delete('/game/:id', function (req, res) {
    gameDB.deleteGame(gameID, ...);
});
```

![DELETE /game/:id vulnerable code](../Assets/Nachiketh/code/controller_app.js-_526-551.png)

*Fixed code:*
```javascript
app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) {
    gameDB.deleteGame(gameID, ...);
});
```

**8. POST /users/:uid/game/:gid/review (original lines 554–582) — No auth, no user verification**

*Vulnerable code:*
```javascript
app.post('/users/:uid/game/:gid/review', function (req, res) {
    reviewDB.insertReview(userid, gameID, content, rating, ...);
});
```

![POST review vulnerable code](../Assets/Nachiketh/code/controller_app.js-_554-582.png)

*Fixed code — `verifyToken` added:*
```javascript
app.post('/users/:uid/game/:gid/review', verifyToken, function (req, res) {
    reviewDB.insertReview(userid, gameID, content, rating, ...);
});
```

**9. Login error leakage (original lines 123–153) — sends raw error to client**

*Vulnerable code:*
```javascript
else {
    res.status(500);
    res.send(err.statusCode);   // exposes raw error object
}
```

![Login error leakage code](../Assets/Nachiketh/code/controller_app.js-_123-153.png)

*Fixed code:*
```javascript
else {
    res.status(500);
    res.json({ success: false, message: 'Login failed' });
}
```

**10. New middleware — `auth/requireAdmin.js` (created)**

A new middleware file was added to check that the authenticated user has the `admin` role after `verifyToken` has populated `req.type`:

```javascript
function requireAdmin(req, res, next) {
    if (req.type !== 'admin') {
        res.status(403);
        return res.json({ auth: false, message: 'Admin access required!' });
    }
    next();
}
module.exports = requireAdmin;
```

**11. Import added to `controller/app.js` (line 15)**

![New requireAdmin import](../Assets/Nachiketh/code/controller_app.js-_14.png)

```javascript
var requireAdmin = require('../auth/requireAdmin.js');
```

**Exploitation:**

*Step 1 — Discover unprotected endpoints via API exploration*

Using Bruno API Client, I enumerated the available endpoints. The collection (visible in `API-Testing/opencollection.yml`) revealed multiple endpoints with no authentication requirement.

![API Testing Overview](../Assets/Nachiketh/01 -APITesting.png)

*Step 2 — Create an admin account without authentication*

Since `POST /users` accepts a `type` field from the client with no validation, I sent a request to `POST http://localhost:8081/users` with the JSON body:

```json
{
  "username": "hacker_admin",
  "email": "hacker@example.com",
  "password": "pwned123",
  "type": "admin"
}
```

The server responded with `201 Created` and a new user ID, confirming the admin account was created without any authentication or authorisation.

![Creating Admin Account via Bruno](../Assets/Nachiketh/11-Brunocancreate an account ad admon.png)

*Step 3 — Delete a game without authentication*

A simple `DELETE` request to `http://localhost:8081/game/14` with no Authorization header succeeded, returning `204 No Content`. This removed a game from the database with zero access control.

![Unauthorized DELETE game](../Assets/Nachiketh/12-Anyonecandeletegames.png)

*Step 4 — Add a game, category, or platform without authentication*

Similarly, `POST /game`, `POST /category`, and `POST /platform` all accepted requests without any token, allowing an attacker to inject arbitrary data into the system.

*Step 5 — Bypass client-side admin check in the frontend*

The admin dashboard (`admin.html`) implements its access control entirely on the client side:

```javascript
async function checkAdmin(){
    const token = localStorage.getItem('Token');
    if(!token){ lock(); return; }
    try{
        const res = await fetch(apiBase + '/CheckRole', { headers: { 'Authorization': 'Bearer ' + token } });
        if(!res.ok){ lock(); return; }
        const d = await res.json();
        if(d.role !== 'Admin' && d.role !== 'admin'){ lock(); }
    }catch(e){ console.error(e); lock(); }
}
function lock(){
    document.getElementById('adminContent').classList.add('locked');
    document.getElementById('lockedMessage').classList.remove('d-none');
}
```

The `lock()` function merely adds a CSS class `locked` (which sets `opacity: .6`) — it does not remove the content from the DOM, nor does it block navigation to admin pages. An attacker can trivially bypass this by:

1. Opening browser Developer Tools
2. Removing the `locked` class from the element
3. Accessing all admin functionality directly

![Browser Dev Tools Bypassing Admin Lock](../Assets/Nachiketh/10 - Insecure Browser tools.png)

**Impact:**

- **Privilege Escalation:** Any user can create an admin account by setting `type: "admin"`.
- **Data Integrity Loss:** Any attacker can add, modify, or delete games, categories, and platforms.
- **Complete System Compromise:** An attacker with admin-level access can manipulate the entire game catalog and user database.
- **Client-Side Bypass:** The frontend "protection" is purely cosmetic and provides no real security.

**Code Snippet to Solve the Vulnerability:**

The fix involved several layers. For the controller layer: (1) creating a new `requireAdmin` middleware in `auth/requireAdmin.js`, and (2) adding both `verifyToken` and `requireAdmin` to every endpoint that modifies or accesses protected data. For `POST /users`, the `type` field is now hardcoded to `'user'` instead of trusting the client. For `POST /users/:uid/game/:gid/review`, only `verifyToken` is added (any authenticated user may post reviews). The login error handler now returns a generic message instead of exposing the raw error object. For the model layer: SQL injection in `model/users.js` and `model/game.js` was fixed by replacing template literal interpolation with parameterised queries. The `password` column was removed from the `getUser` and `getUserByUserid` SELECT queries. The hardcoded JWT secret in `config.js` was replaced with `process.env.JWT_SECRET`. In `auth/verifyToken.js`, the `console.log(req.headers)` and `console.log(token)` lines were removed to prevent leaking sensitive data to logs. The complete set of old and new code for each endpoint and each file is shown above in the Affected Code sections.

---

### Brief Finding 1: GET /users Exposes All User Data (Including Passwords)

**Type of Flaw:** Insecure Direct Object Reference (IDOR) / Mass Assignment — the `GET /users` endpoint returns all user records with plaintext passwords to anyone, with no authentication required.

**Affected Code:**

**Identify Code Snippet Exposing the Vulnerability:**

In `controller/app.js`, the `GET /users` endpoint has no authentication middleware. In `model/users.js`, the SQL query selects the `password` column, returning it in plaintext.

*Vulnerable code (`controller/app.js` lines 219–241):*

```javascript
app.get('/users', function (req, res) {
    userDB.getUser(function (err, results) {
        if (err) {
            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        } else {
            res.status(200);
            res.type("json");
            res.send(results);   // <-- sends ALL fields including password
        }
    });
});
```

*Vulnerable code (`model/users.js` lines 28–29) — SQL query selects `password`:*

```javascript
var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

*Fixed code (`controller/app.js`) — `verifyToken` and `requireAdmin` added:*

```javascript
app.get('/users', verifyToken, requireAdmin, function (req, res) {
    userDB.getUser(function (err, results) { /* ... */ });
});
```

*Fixed code (`model/users.js`) — `password` removed from SELECT:*

```javascript
var getUserSql = `select userid, username, email, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

Note that passwords are stored and transmitted in **plaintext** (no hashing).

![GET /users exposing all users](../Assets/Nachiketh/02 - ExposedUsersOnPort8001.png)

![Passwords visible in plaintext](../Assets/Nachiketh/03 - PasswordsUnhashed.png)

**Impact:** Full account takeover of every registered user. An attacker can use any exposed email/password combination to log in and obtain a valid JWT, then impersonate that user for all subsequent operations. This was verified by taking Alex's credentials from the exposed list and logging in successfully.

![Login as Alex using exposed credentials](../Assets/Nachiketh/04 - LogInasAlex.png)

![Password confirmed](../Assets/Nachiketh/05 - ExposedPassword.png)

**Recommendation:**

The `GET /users` endpoint must require authentication via the `verifyToken` middleware, and should additionally check that the requester has admin privileges before returning the full user list. The `password` column should be removed from the SQL SELECT query or stripped server-side before the response is sent. More fundamentally, passwords must be hashed using a strong algorithm like bcrypt or Argon2 before storage — this would prevent credential exposure even if the data is accidentally leaked.

---

### Detailed Finding 3: SQL Injection in Model Layer (Users & Games)

**Type of Flaw:** SQL Injection (SQLi) — user-controlled values are interpolated directly into SQL query strings via template literals (`${...}`), allowing an attacker to inject arbitrary SQL commands.

**Identify Code Snippet Exposing the Vulnerability:**

The model layer contains multiple SQL queries built with string interpolation instead of parameterised placeholders (`?`).

**1. `model/users.js` lines 100–103 — SQLi in `getUserByUserid` + password column leak:**

*Vulnerable code:*

```javascript
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;

dbConn.query(getUserByUserIDSql, [], function (err, results) {
```

![user.js getUserByUserid vulnerable code](../Assets/Nachiketh/code/model/user.js :100-116.png)

*Issues:*
- `${userid}` is interpolated directly — no parameterisation
- Empty `[]` array is passed — the `?` count is zero, so all parameters are unused
- `password` column is selected, exposing plaintext passwords even to admin query results

*Fixed code — parameterised query, password removed, proper parameter array:*

```javascript
var getUserByUserIDSql = `select userid, username, email, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ?;`;

dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
```

**2. `model/users.js` line 28 — `password` column in `getUser` query:**

*Vulnerable code:*

```javascript
var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

![user.js getUser password column](../Assets/Nachiketh/code/model/user.js :28.png)

*Fixed code — `password` column removed:*

```javascript
var getUserSql = `select userid, username, email, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

**3. `model/game.js` lines 157–160 — SQLi in `insertGame`:**

*Vulnerable code:*

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
dbConn.query(insertGameSql, [game_image.buffer], function (err, results) {
```

![game.js insertGame vulnerable code](../Assets/Nachiketh/code/model/game.js :144-176.png)

*Issues:*
- `title`, `game_description`, `year` are interpolated directly
- Only `game_image.buffer` is passed as a parameter
- A title like `'); DROP TABLE game; --` would execute arbitrary SQL

*Fixed code — all values parameterised:*

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES (?, ?, ?, ?);`;
dbConn.query(insertGameSql, [title, game_description, year, game_image.buffer], function (err, results) {
```

**4. `model/game.js` lines 303–306 — SQLi in `updateGame`:**

*Vulnerable code:*

```javascript
var updateGameSql = `update game set title='${title}', game_description='${game_description}', year='${year}', game_image='${game_image.buffer}' where gameID='${gameID}`;
dbConn.query(updateGameSql, [], function (err, results) {
```

![game.js updateGame vulnerable code](../Assets/Nachiketh/code/model/game.js :291-322.png)

*Issues:*
- All four fields are interpolated directly with single-quote wrapping
- `gameID` is missing a closing single quote (`gameID='\${gameID}`) — this is a syntax error waiting to break
- `game_image.buffer` (a binary Buffer) is coerced to a string via `${}`, corrupting the image data
- Empty `[]` parameter array

*Fixed code — fully parameterised with proper syntax:*

```javascript
var updateGameSql = `UPDATE game SET title=?, game_description=?, year=?, game_image=? WHERE gameID=?;`;
dbConn.query(updateGameSql, [title, game_description, year, game_image.buffer, gameID], function (err, results) {
```

**5. `config.js` — hardcoded JWT signing secret:**

*Vulnerable code:*

```javascript
var secret='Assignment2key'; //your own secret key
module.exports.key = secret;
```

![config.js hardcoded secret](../Assets/Nachiketh/code/model/config.js.png)

*Issue:* The JWT signing key is hardcoded as `'Assignment2key'` in source code. Anyone with access to the repository can forge valid JWTs and impersonate any user, including admin users.

*Fixed code — secret loaded from environment variable:*

```javascript
var secret = process.env.JWT_SECRET;
if (!secret) {
    console.error('FATAL: JWT_SECRET environment variable is not set.');
    process.exit(1);
}
module.exports.key = secret;
```

**Exploitation:**

*Step 1 — SQL injection via game title*

Send a `POST /game` request with a crafted title. For example:

```
POST /game HTTP/1.1
Content-Type: multipart/form-data

title='); DROP TABLE game; --
```

The interpolated query becomes:
```sql
INSERT INTO game (title, game_description, year, game_image) VALUES (''); DROP TABLE game; --', '...', '...', ?);
```

This would delete the `game` table entirely, effectively destroying the application's primary data store.

*Step 2 — SQL injection via user ID*

Send a `GET /users/<malicious>` request with a crafted userid parameter:
```
GET /users/1 OR 1=1
```

The interpolated query becomes:
```sql
SELECT ... FROM users WHERE userid = 1 OR 1=1;
```

This returns all users, bypassing the intended single-user lookup.

*Step 3 — JWT forgery with hardcoded secret*

Since the secret is `'Assignment2key'`, anyone who reads `config.js` can create a valid JWT with `type: "admin"`:
```javascript
var forgedToken = jwt.sign({ userid: 999, type: 'admin' }, 'Assignment2key');
```

This forged token passes both `verifyToken` and `requireAdmin` checks, granting full administrative access.

**Impact:**

- **Complete Database Compromise:** SQL injection in both INSERT and UPDATE queries allows arbitrary read/write access to the database (SELECT, INSERT, UPDATE, DELETE, DROP).
- **Data Exfiltration:** The `getUserByUserid` query can be manipulated to return any data from any table.
- **Authentication Bypass:** The hardcoded JWT secret enables anyone to forge administrative tokens.
- **Data Corruption:** The `updateGame` query has a syntax error (missing closing quote) that would cause the function to fail or produce undefined behaviour.

**Recommendation:**

All database queries must use parameterised statements (the `?` placeholder pattern used in other model functions like `category.js` and `platform.js`). Template literal interpolation (`${...}`) should never appear inside SQL strings. The JWT signing key must be loaded from an environment variable or secrets manager, never hardcoded. The `password` column should only be selected when necessary for authentication (login flow), not in user listing or profile queries. Passwords should be hashed with bcrypt before storage.

---

## A09 — Security Logging & Monitoring Failures

Security Logging & Monitoring Failures (previously called "Insufficient Logging & Monitoring") occur when the application fails to generate, preserve, or monitor audit records for security-relevant events. This makes it impossible to detect, investigate, or respond to attacks in progress or reconstruct incidents after the fact.

---

### Detailed Finding 2: No Audit Logs on Sensitive Operations

**Type of Flaw:** Complete absence of security-relevant audit logging — the application logs only generic console output (`console.log(err)`) for error conditions but never records who performed what action, when, or from which IP address.

**Affected Code:**

The application uses `console.log()` throughout, but only for debugging purposes (printing request headers, tokens, or errors). There is **no structured audit logging** for security events.

*`controller/app.js` — Error logging pattern (e.g., line 77, 105, 174, 227, etc.):*

```javascript
if (err) {
    console.log(err);   // only logs the error object, no context about who, what, when
    res.status(500);
    res.type("json");
    res.send(`{"Message":"some error encounted!"}`);
}
```

*`controller/app.js` line 134 — Login response logs user data (including password exposure risk):*

```javascript
console.log(result);   // logs entire result object including password field
```

*`controller/app.js` line 158 — Logout:*

```javascript
app.post('/users/logout', function (req, res) {
    console.log("..logging out.");  // no user identity logged
    // ...
});
```

*`controller/app.js` lines 557–582 — POST review with no logging of the actor:*

```javascript
app.post('/users/:uid/game/:gid/review', function (req, res) {
    var userid = req.params.uid;
    var gameID = req.params.gid;
    // ...
    reviewDB.insertReview(userid, gameID, content, rating, function (err, results) {
        // ...
    });
});
```

There is no IP address logging, no timestamped audit trail, no logging of who performed destructive actions (DELETE, POST), and no monitoring of failed authentication attempts.

**Exploitation:**

*Step 1 — Perform destructive actions with no audit trail*

When an attacker deletes a game via `DELETE /game/14`, the server simply returns `204 No Content`. The only server-side output is the request headers printed by the `verifyToken` middleware (but since no middleware is applied, even that doesn't happen). There is no record of which user performed the delete, what time it occurred, what resource was deleted, or the source IP address.

The server console shows no meaningful audit data:

![Server console output lacks audit information](../Assets/Nachiketh/08-Consolecoammnd.png)

*Step 2 — Create an admin account without triggering any alert*

The `POST /users` endpoint succeeds silently. No log entry is created to indicate that a user with `type: "admin"` was registered. A security team would have no way of knowing that privilege escalation occurred.

*Step 3 — Impersonate other users with no forensic evidence*

The `POST /users/:uid/game/:gid/review` endpoint accepts any user ID in the URL path — there is no verification that the requesting user matches the `:uid` parameter. An attacker can post a review as any user without leaving an audit trail.

![Impersonation via POST review](../Assets/Nachiketh/13-Exposure.png)

The Bruno collection includes `15-Impersonate-Review-POST.yml` which demonstrates this:

```yaml
name: 15 - Impersonate Review - POST /users/1/game/12/review (VULNERABILITY)
http:
  method: POST
  url: http://localhost:8081/users/1/game/12/review
  body:
    type: json
    data: |-
      {
        "content": "This review was posted by someone else!",
        "rating": 5
      }
```

*Step 4 — Brute-force login attempts go undetected*

The login endpoint (`POST /users/login`) logs only generic error messages on authentication failure, but does not track the number of failed attempts per email address, the source IP, or the timestamp. An attacker can brute-force passwords indefinitely without triggering any account lockout or alert.

**Impact:**

- **No Incident Detection:** Intrusions and attacks cannot be detected in real-time because there are no security events to monitor.
- **No Forensic Evidence:** After a breach, there is no audit trail to determine the scope, method, or perpetrator of the attack.
- **Compliance Violation:** Regulatory frameworks (PCI-DSS, GDPR, SOX) require detailed audit logging of access to sensitive data.
- **Impossible to Reconstruct Attacks:** Without timestamps, user identities, and action descriptions, reconstructing an attack timeline is impossible.

**Recommendation:**

A structured logging library such as Winston, Morgan, or Pino should be introduced to log security events with consistent fields: timestamp, user ID, source IP, HTTP method, URL path, and response status. At minimum, the following events must be logged: successful and failed login attempts, account creation (especially admin accounts), all DELETE/POST/PUT operations on sensitive resources, access-denied (403) responses, and token verification failures. These logs should be persisted to rotating files or a central monitoring service (e.g., AWS CloudWatch, ELK Stack). An account lockout mechanism should also be implemented after N consecutive failed login attempts, with each attempt logged. Crucially, sensitive data such as passwords and full token values must never be written to logs.

---

### Brief Finding 2: Verbose Error Messages Leak Information

**Type of Flaw:** Verbose error handling that exposes internal implementation details — error messages returned to the client and logged to the console include database error objects, SQL syntax details, and stack traces.

**Affected Code:**

Throughout `controller/app.js`, error responses return generic messages, but the server logs full error objects via `console.log(err)`, which in production should never be visible.

*`model/users.js` lines 100–101 — SQL injection point also acts as an information leak:*

```javascript
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;
```

When a malformed or SQL-injected value is passed, the database error (including the full SQL query) is returned to the client via the generic error handler, or logged to the console.

*`model/game.js` lines 159 — SQL injection via template literals:*

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

A failed SQL injection attempt reveals the SQL syntax error in the server console output.

*`auth/verifyToken.js` lines 6–9 — Leaks request headers and token values to console:*

*Vulnerable code:*

```javascript
function verifyToken(req, res, next) {
    console.log(req.headers);   // logs ALL request headers including Authorization: Bearer <token>

    var token = req.headers['authorization'];
    console.log(token);         // logs the raw JWT token value
```

![verifyToken.js logging headers and token](../Assets/Nachiketh/code/model/verify.js.png)

When `verifyToken` is ineffective or absent (as it was on most endpoints), these are the only log lines that fire, and they expose the full JWT token and all headers to the console.

*Fixed code — sensitive logging removed:*

```javascript
function verifyToken(req, res, next) {

    var token = req.headers['authorization'];
```

*`controller/app.js` — Generic error handler pattern:*

```javascript
if (err) {
    console.log(err);  // logs full SQL error with query structure
    res.status(500);
    res.type("json");
    res.send(`{"Message":"some error encounted!"}`);
}
```

While the client-facing error message is generic (`"some error encounted!"`), the full error details are logged to `console.log(err)`. If the application is deployed with console output accessible (e.g., CloudWatch, Heroku logs, Docker logs), an attacker who triggers errors can gain visibility into the database schema, table names, column names, and query structure.

![SQL Injection error revealing structure](../Assets/Nachiketh/14-SQL Injection.png)

**Impact:** Information leakage can aid attackers in crafting more sophisticated attacks. Knowledge of table names, column names, and query structure makes SQL injection, IDOR, and other attacks significantly easier.

**Recommendation:**

In production, full error objects should never be logged to console. Instead, a global error handler should return standardised, generic error responses to clients while logging detailed information securely to file with configurable log levels. Error messages must be sanitised to remove SQL query details, file paths, and stack traces before any output. Additionally, parameterised queries should be used throughout (as in most other model functions) to replace the template-literal string interpolation seen in `getUserByUserid` and `insertGame`, which would eliminate both the SQL injection vulnerability and the accompanying information leakage.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| **Bruno API Client** | Manual and automated API request crafting; testing endpoints without authentication, SQL injection payloads, and JWT tampering. Collection saved in `API-Testing/`. |
| **Browser Developer Tools** | Inspecting network traffic, modifying DOM elements to bypass client-side access controls, viewing `localStorage` tokens. |
| **curl** | Quick command-line verification of endpoint accessibility and response inspection. |
| **VS Code** | Source code review — tracing endpoint routes, middleware application, and database query construction. |

## Conclusion

The analysis of this web application reveals **critical failures in access control (A01)** and **security logging & monitoring (A09)** — two of the most impactful categories in the OWASP Top 10 2021.

For **A01 — Broken Access Control**, the application fundamentally lacks server-side authorisation. The `verifyToken` middleware is applied to only a single endpoint (`/CheckRole`), and even that endpoint performs no role-based enforcement. Data-modifying operations (`POST /game`, `DELETE /game/:id`, `POST /category`, `POST /platform`, `POST /users`) are completely unprotected, allowing any unauthenticated attacker to create admin accounts, delete games, and manipulate the entire catalogue. The frontend admin check is purely cosmetic, implemented as a CSS class toggle that any user can bypass with browser developer tools. User data, including plaintext passwords, is exposed en masse via `GET /users`. Further compounding the issue, SQL injection vulnerabilities exist in `model/users.js` and `model/game.js` where user input is interpolated directly into query strings, and the JWT signing secret is hardcoded in `config.js` as `'Assignment2key'`, enabling token forgery.

For **A09 — Security Logging & Monitoring Failures**, the application generates no meaningful audit trail. Security-relevant events — account creation, privilege escalation, data deletion, failed login attempts — pass silently with no record of who performed the action, when, or from where. This makes incident detection impossible and forensics after a breach infeasible. Verbose error logging leaks database schema details and SQL query structures to console output, aiding attackers in crafting more precise exploits. The `auth/verifyToken.js` middleware actively leaks sensitive data by logging full request headers and raw JWT token values to the console.

Both categories share a common root cause: **treating security as a client-side concern** and **failing to enforce controls at the server boundary**. The recommended fixes — applying authentication and RBAC middleware to all endpoints, parameterising all SQL queries, removing plaintext password storage, loading secrets from environment variables, implementing structured audit logging, and sanitising error output — would collectively raise the application's security posture from critically vulnerable to reasonably defended against these attack vectors.
