# Week 0 — Nachiketh Scouting Report

---
**Title:** Week 0 — A01 & A09 Scouting
**Written by:** Nachiketh Reddy Y
**Collaborators:** Sitt, Mike, Keefe
**Reviewed by:**
**Date:** 2026-06-08
---

## 1. Owner

- Name: Nachiketh Reddy Y
- GitHub username: NachikethReddyY
- Assigned OWASP category/categories: A01: Broken Access Control, A09: Security Logging and Monitoring Failures
- Date: 2026-06-08

## 2. Scope I Scouted

List the files, pages, endpoints, database tables, and flows you inspected.

| Area | File / URL / Endpoint | Why it matters |
| --- | --- | --- |
| Frontend | `Assignment/FrontEndServer/Public/*.html` | Login, register, game CRUD pages — check client-side auth enforcement |
| Backend route/controller | `controller/app.js` lines 1-679 | All Express routes — verify auth middleware presence |
| Auth middleware | `auth/verifyToken.js` lines 1-35 | JWT verification logic — check if properly enforced |
| Model/database query | `model/users.js`, `model/game.js`, `model/platform.js`, `model/category.js`, `model/review.js` | SQL queries — check for IDOR and sensitive data exposure |
| Config/auth/secrets | `config.js` | JWT secret key strength |
| Database config | `model/databaseConfig.js` | Connection credentials and defaults |
| Server entry | `server.js` | Middleware stack and static file serving |
| Other | `Meeting/02-Jun-26.md` | Team assignment and OWASP breakdown |

## 3. Potential Vulnerabilities Found

| Candidate flaw | OWASP category | Evidence location | Detailed or brief? | Confidence |
| --- | --- | --- | --- | --- |
| No authentication on most endpoints | A01 | `controller/app.js` — only `/CheckRole` uses `verifyToken` | Detailed | High |
| IDOR: GET /users returns all users with passwords | A01 | `controller/app.js:219`, `model/users.js:28-29` | Detailed | High |
| IDOR: GET /users/:userid returns any user's data (no ownership check) | A01 | `controller/app.js:308`, `model/users.js:100-101` | Detailed | High |
| IDOR: DELETE /game/:id — any user can delete any game | A01 | `controller/app.js:529`, `model/game.js:271` | Detailed | High |
| IDOR: POST /users/:uid/game/:gid/review — uid from URL param, not token | A01 | `controller/app.js:557-560` | Detailed | High |
| No RBAC: POST /game, /category, /platform have no role checks | A01 | `controller/app.js:337,387,435` | Detailed | High |
| POST /users allows client-supplied 'type' (can register as admin) | A01 | `controller/app.js:253`, `model/users.js:65` | Detailed | High |
| Hardcoded weak JWT secret in config.js | A07/A01 | `config.js:1` — `Assignment2key` | Brief | High |
| SQL injection in insertGame via string interpolation | A03 | `model/game.js:159` — `VALUES ('${title}', '${game_description}', '${year}', ?)` | Detailed | High |
| SQL injection in updateGame via string interpolation | A03 | `model/game.js:305` — `SET title='${title}'...` | Detailed | High |
| SQL injection in getUserByUserid via template literal | A03 | `model/users.js:101` — `WHERE userid = ${userid}` | Detailed | High |
| No structured logging anywhere | A09 | Entire app — only `console.log()` used | Detailed | High |
| No audit trail for user creation | A09 | `model/users.js:52-82` — no log of who created which user | Detailed | High |
| No failed login attempt tracking | A09 | `controller/app.js:123-153` — login failures silently logged | Detailed | High |
| No access denial logging | A09 | `auth/verifyToken.js` — 403 responses are not logged | Detailed | High |
| Passwords stored in plain text | A02 | `model/users.js` — no bcrypt or hashing | Brief | High |
| No rate limiting on login or any endpoint | A07 | `controller/app.js` — no `express-rate-limit` | Brief | Medium |
| CORS wide open | A01 | `controller/app.js:20-21` — `app.use(cors())` with no origin restriction | Brief | Medium |

## 4. Exploit Scout Notes

### Finding 1: No auth on most endpoints

- Preconditions: None (no token or session required)
- Test account/role needed: None
- Request or page used: Any unprotected endpoint (e.g., `GET /game`, `DELETE /game/1`)
- Expected impact: Unauthenticated attacker can read/write/delete all resources
- Safe test payload/demo idea: `curl http://localhost:8081/game` returns all games without any auth header

### Finding 2: IDOR — GET /users/:userid exposes any user + password

- Preconditions: None
- Test account/role needed: None
- Request or page used: `GET /users/1`
- Expected impact: Attacker enumerates user IDs to harvest all accounts + passwords
- Safe test payload/demo idea: `curl http://localhost:8081/users/1` shows user 1's password

### Finding 3: IDOR — POST /users/:uid/game/:gid/review ignores token userid

- Preconditions: Attacker has any valid JWT (or can register)
- Test account/role needed: Any valid user
- Request or page used: `POST /users/5/game/1/review` with token for userid=2
- Expected impact: Attacker can impersonate any user when writing reviews
- Safe test payload/demo idea: Register user A, get token, then POST review with a different uid

### Finding 4: POST /users allows client to set role (type)

- Preconditions: None
- Test account/role needed: None
- Request or page used: `POST /users` with `type: "admin"` in body
- Expected impact: Anyone can register as an administrator
- Safe test payload/demo idea: `curl -X POST http://localhost:8081/users -H "Content-Type: application/json" -d '{"username":"hacker","email":"hacker@x.com","password":"hack123","type":"admin"}'`

### Finding 5: No audit trail for sensitive actions (A09)

- Preconditions: None
- Test account/role needed: None
- Request or page used: Any CRUD operation
- Expected impact: No forensic evidence of attacks — breaches impossible to investigate
- Safe test payload/demo idea: Delete a game, then check logs — only a console.log exists

## 5. Code Evidence

```text
File: controller/app.js
Lines: 57-64 (only endpoint with auth), 219-241 (GET /users — no auth)
Snippet:
  // Verifying user role — ONLY endpoint using verifyToken
  app.get('/CheckRole', verifyToken, function (req, res) {
      const userRole = req.type;
      res.send({ role: userRole });
  });

  // GET /users — NO verifyToken, returns ALL users
  app.get('/users', function (req, res) {
      userDB.getUser(function (err, results) { ... });
  });
```

```text
File: controller/app.js
Lines: 529-551
Snippet:
  // DELETE /game/:id — NO auth at all, any user can delete any game
  app.delete('/game/:id', function (req, res) {
      var gameID = req.params.id;
      gameDB.deleteGame(gameID, function (err, results) { ... });
  });
```

```text
File: model/users.js
Lines: 28-29, 100-101
Snippet:
  // getUser — returns password column
  var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;

  // getUserByUserid — SQL injection via template literal + returns password
  var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
                            FROM users where userid = ${userid};`;
```

```text
File: controller/app.js
Lines: 557-582
Snippet:
  // POST /users/:uid/game/:gid/review — uid from URL, NOT from decoded token
  app.post('/users/:uid/game/:gid/review', function (req, res) {
      var userid = req.params.uid;   // <-- attacker controls this
      var gameID = req.params.gid;
      var content = req.body.content;
      var rating = req.body.rating;
      reviewDB.insertReview(userid, gameID, content, rating, ...);
  });
```

```text
File: controller/app.js
Lines: 247-302
Snippet:
  // POST /users — type is client-supplied, no validation
  app.post('/users', function (req, res) {
      var username = req.body.username;
      var email = req.body.email;
      var password = req.body.password;
      var type = req.body.type;             // <-- can be "admin"!
      ...
      userDB.insertUser(username, email, password, type, profile_pic_url, ...);
  });
```

```text
File: model/game.js
Lines: 159, 305
Snippet:
  // SQL injection — string interpolation instead of parameterized query
  var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;

  var updateGameSql = `update game set title='${title}', game_description='${game_description}', year='${year}', game_image='${game_image.buffer}' where gameID='${gameID}`;
```

```text
File: model/users.js
Line: 101
Snippet:
  // SQL injection — template literal directly interpolated
  var getUserByUserIDSql = `...FROM users where userid = ${userid};`;
```

```text
File: auth/verifyToken.js
Lines: 13, 22
Snippet:
  // No logging of denied access attempts
  if (!token || !token.includes('Bearer')) {
      res.status(403);
      return res.send({ auth: 'false', message: 'Not authorized!' });
      // No console.error or log entry here
  }
```

## 6. Fix Direction

### A01 — Broken Access Control

- **Recommended approach:** Add `verifyToken` middleware to all protected routes; implement role-based checks for admin-only operations; use decoded `req.userid` instead of URL params for ownership; never return password field in queries
- **Code area to change:**
  - `controller/app.js` — add `verifyToken` to all routes except public ones; replace URL param `uid` with `req.userid`
  - `model/users.js` — remove `password` from SELECT in getUser/getUserByUserid; parameterize all queries
  - `model/game.js` — parameterize `insertGame` and `updateGame` SQL
- **Libraries/middleware needed:** `express-rate-limit`, `cors` with explicit origin allowlist
- **Possible side effects:** Frontend code that expects unprotected access will need updates (e.g., login page calling API without token)

### A09 — Security Logging and Monitoring Failures

- **Recommended approach:** Replace all `console.log` with a structured logger (Winston or Pino); log auth failures, access denials, and sensitive operations with timestamp and user context
- **Code area to change:**
  - `controller/app.js` — add logger middleware
  - `auth/verifyToken.js` — log denied tokens
  - `model/databaseConfig.js` — log connection errors
- **Libraries/middleware needed:** `winston` or `pino` for structured logging
- **Possible side effects:** Log files need rotation and storage planning

## 7. Tools and Methods Used

Examples: browser devtools, curl, Postman, SQLMap, npm audit, manual code review.

- Tool/method: Manual code review
  - What I tested: All Express route handlers for missing verifyToken
  - Result: 13/14 endpoints lack auth middleware

- Tool/method: Manual code review
  - What I tested: SQL query construction patterns (parameterized vs string interpolation)
  - Result: 3 queries use string interpolation (SQL injection), rest use parameterized

- Tool/method: Manual code review
  - What I tested: JWT secret strength and token verification flow
  - Result: Weak hardcoded secret 'Assignment2key', verifyToken only used on 1 endpoint

- Tool/method: Manual code review
  - What I tested: Password storage and user registration flow
  - Result: Passwords stored in plain text, type field unvalidated

- Tool/method: Manual code review
  - What I tested: Logging coverage across the app
  - Result: Zero structured logging, no audit trail

## 8. What I Want To Do Next

- [x] Map all endpoints with auth status (Done)
- [x] Identify SQL injection points (Done)
- [x] Document user/data leakage paths (Done)
- [x] Test direct API access bypass (Done)
- [x] Identify logging gaps (Done)
- [x] Pick detailed & brief A01/A09 candidates (Done)
- [ ] Confirm exploit safely (Week 1)
- [ ] Capture screenshots/logs
- [ ] Create proof-of-concept request or script
- [ ] Draft vulnerable-code explanation
- [ ] Draft fix snippet
- [ ] Ask teammate to review finding

## 9. Questions / Blockers

- Need clarity on whether GET /category and GET /platform should remain public (read-only OK)
- Confirm if the project expects admin/users distinction in the database seed data
- Need to coordinate A02 (Cryptographic Failures) backup with Keefe since passwords are plaintext

## 10. Academic Integrity Reminder

Write in your own words. Do not copy another person's finding text. Collaboration is allowed for testing and review, but each person's scouting notes should show their own understanding.
