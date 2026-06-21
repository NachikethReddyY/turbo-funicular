---
title: Week 0 — A04 Insecure Design Scouting
author: Sitt
collaborators: Nachiketh Reddy Y, Mike Franco Abat, Keefe
reviewed_by:
date: 2026-06-08
---

# Week 0 — Sitt Scouting Report

## 1. Owner

- Name: Sitt
- GitHub username:
- Assigned OWASP category/categories: A04: Insecure Design
- Date: 2026-06-08

## 2. Scope I Scouted

List the files, pages, endpoints, database tables, and flows you inspected.

| Area | File / URL / Endpoint | Why it matters |
| --- | --- | --- |
| Frontend | `Assignment/FrontEndServer/Public/admin.html` | Admin dashboard — client-side role gate only |
| Frontend | `Assignment/FrontEndServer/Public/addNewCategory.html`, `addNewPlatform.html`, `addNewGame.html` | Admin CRUD pages — `checkAdmin()` before submit |
| Frontend | `Assignment/FrontEndServer/Public/register.html` | Registration sends client-controlled `type` field |
| Frontend | `Assignment/FrontEndServer/Public/login.html` | Remember-me stores plaintext password in localStorage |
| Frontend | `Assignment/FrontEndServer/Public/newHome.html`, `gamesSearch.html` | Hides admin nav tabs via JS, not server |
| Backend route/controller | `Assignment/BackEndServer/controller/app.js` | All routes — only `/CheckRole` uses `verifyToken` |
| Auth middleware | `Assignment/BackEndServer/auth/verifyToken.js` | JWT decode exists but is not wired into admin/write flows |
| Model/database query | `Assignment/BackEndServer/model/users.js`, `game.js`, `review.js` | Registration, login, and review data flows |
| Config/auth/secrets | `Assignment/BackEndServer/config.js`, `model/databaseConfig.js` | Secrets and DB config baked into code |
| Database | `spgames_SC.sql` — `users` table | Role values (`Customer`) vs UI values (`user`, `Admin`) |
| Flow | Login → admin.html → POST /category, /platform, /game | Intended admin path vs actual API enforcement |
| Other | GitHub issues #93, #114–#118, #139 | Week 0 A04 scouting tasks |

## 3. Potential Vulnerabilities Found

| Candidate flaw | OWASP category | Evidence location | Detailed or brief? | Confidence |
| --- | --- | --- | --- | --- |
| Admin access enforced only in frontend (`checkAdmin`) | A04 | `addNewCategory.html:68-82`, `app.js:337-495` | Detailed | High |
| `/CheckRole` returns role but no route enforces it | A04 | `app.js:57-64` vs `app.js:337+` | Detailed | High |
| POST /users accepts client-supplied `type` (privilege escalation by design) | A04 | `app.js:253`, `register.html:70-73` | Detailed | High |
| No canonical role model (`user` / `Customer` / `Admin` mismatch) | A04 | `register.html`, `spgames_SC.sql`, admin pages | Detailed | High |
| State-changing endpoints designed without auth middleware | A04 | `app.js` — POST/DELETE on category, platform, game, review | Detailed | High |
| Review endpoint uses URL `uid`, not token identity | A04 | `app.js:557-560`, `newGame-Detail.html:83` | Detailed | High |
| Remember-me stores password in localStorage | A04 | `login.html:101` | Detailed | High |
| No server-side input validation schema | A04 | `app.js` POST handlers, `model/*.js` | Detailed | High |
| File upload has no auth, size limit, or strong validation | A04 | `app.js:24-42`, `app.js:435` | Brief | High |
| Auth designed with plaintext password compare (no hashing layer) | A04 / A07 | `model/users.js:136-138` | Brief | High |
| GET /users designed to return password column publicly | A04 / A01 | `app.js:219`, `model/users.js:28-29` | Brief | High |
| Hardcoded JWT secret in source | A04 | `config.js:1` | Brief | Medium |

## 4. Exploit Scout Notes

### Finding 1: Frontend-only admin control (bypass via direct API)

- Preconditions: None — no login required
- Test account/role needed: None
- Request or page used: `POST http://localhost:8081/category` with JSON body
- Expected impact: Attacker creates categories/platforms/games/deletes games without ever using admin UI
- Safe test payload/demo idea:
  ```http
  POST http://localhost:8081/category
  Content-Type: application/json

  {"catname": "BypassCategory", "description": "Created without auth"}
  ```

### Finding 2: Register as Admin by tampering registration body

- Preconditions: None
- Test account/role needed: None
- Request or page used: `POST /users` — UI dropdown only shows `"user"`, API accepts any `type`
- Expected impact: Self-created admin account; JWT will contain `type: Admin`
- Safe test payload/demo idea:
  ```http
  POST http://localhost:8081/users
  Content-Type: application/json

  {"username":"test_admin","email":"test@example.com","password":"pass123","type":"Admin","profile_pic_url":"https://example.com/pic.jpg"}
  ```

### Finding 3: Review flow trusts URL userid, not JWT

- Preconditions: None (no token required today)
- Test account/role needed: Optional — can post without auth
- Request or page used: `POST /users/2/game/1/review`
- Expected impact: Reviews attributed to arbitrary users; impersonation and reputation harm
- Safe test payload/demo idea:
  ```http
  POST http://localhost:8081/users/2/game/1/review
  Content-Type: application/json

  {"content": "Fake review", "rating": 5}
  ```

### Finding 4: Admin UI hidden but pages still reachable

- Preconditions: Normal user logged in
- Test account/role needed: Customer / `user` role
- Request or page used: Navigate to `http://localhost:3001/admin.html` or `addNewCategory.html`
- Expected impact: UI may show lock/warning, but API bypass (Finding 1) still works — design gives false sense of security
- Safe test payload/demo idea: Login as normal user, open admin URL directly, then compare with curl API call

### Finding 5: Remember-me stores credentials in browser

- Preconditions: User checks "Remember me" on login
- Test account/role needed: Any account
- Request or page used: `login.html` → DevTools → Application → localStorage
- Expected impact: Plaintext password readable from browser; any XSS steals credentials + JWT
- Safe test payload/demo idea: Login with remember-me, inspect `logPassword` key in localStorage

## 5. Code Evidence

```text
File: Assignment/BackEndServer/controller/app.js
Lines: 57-64
Snippet:
  // Only route using verifyToken — returns role but does not enforce it elsewhere
  app.get('/CheckRole', verifyToken, function (req, res) {
      const userRole = req.type;
      res.status(200);
      res.type("json");
      res.send({ role: userRole });
  });
```

```text
File: Assignment/BackEndServer/controller/app.js
Lines: 337, 387, 435, 529
Snippet:
  // Admin-equivalent routes — NO verifyToken, NO requireAdmin
  app.post('/category',  function (req, res) { ... });
  app.post('/platform', function (req, res) { ... });
  app.post('/game', upload.single('game_image'), function (req, res) { ... });
  app.delete('/game/:id', function (req, res) { ... });
```

```text
File: Assignment/FrontEndServer/Public/addNewCategory.html
Lines: 68-82
Snippet:
  async function checkAdmin(){
      const token = localStorage.getItem('Token');
      ...
      const res = await fetch(apiBase + '/CheckRole', { headers: { 'Authorization': 'Bearer ' + token } });
      return (d.role === 'Admin' || d.role === 'admin');
  }
  // Blocks form submit in browser only — backend POST /category has no matching check
```

```text
File: Assignment/BackEndServer/controller/app.js
Lines: 247-257
Snippet:
  app.post('/users', function (req, res) {
      var username = req.body.username;
      var email = req.body.email;
      var password = req.body.password;
      var type = req.body.type;              // client-controlled role
      var profile_pic_url = req.body.profile_pic_url;
      userDB.insertUser(username, email, password, type, profile_pic_url, ...);
  });
```

```text
File: Assignment/FrontEndServer/Public/register.html
Lines: 70-73, 120, 132
Snippet:
  <select id="type" name="type" class="form-select" required>
    <option value="user" selected>User</option>
  </select>
  // Sent in payload: { username, email, password, type, profile_pic_url }
  // DB seed uses "Customer"; admin checks use "Admin" — no single role enum
```

```text
File: Assignment/BackEndServer/controller/app.js
Lines: 557-564
Snippet:
  app.post('/users/:uid/game/:gid/review', function (req, res) {
      var userid = req.params.uid;    // from URL, not JWT
      var gameID = req.params.gid;
      var content = req.body.content;
      var rating = req.body.rating;
      reviewDB.insertReview(userid, gameID, content, rating, ...);
  });
```

```text
File: Assignment/FrontEndServer/Public/login.html
Line: 101
Snippet:
  if(rememberMe){
      localStorage.setItem('rememberMe','true');
      localStorage.setItem('logEmail', email);
      localStorage.setItem('logPassword', pwd);
  }
```

```text
File: Assignment/BackEndServer/model/game.js
Line: 159
Snippet:
  // Input validation missing at design level; string concat used for text fields
  var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

## 6. Fix Direction

### A04 — Insecure Design (primary)

- **Recommended approach:** Design security into the API first — define roles, middleware chain, and validation rules before UI. Never rely on hidden tabs or client-side `checkAdmin()` as the only control.
- **Code area to change:**
  - `controller/app.js` — add `verifyToken` + `requireAdmin` middleware on POST/DELETE admin routes; force `type = Customer` on registration; use `req.userid` from JWT for reviews
  - `auth/verifyToken.js` — add `requireAdmin` helper that checks `req.type`
  - Frontend admin pages — keep UX checks for convenience, but treat as non-security (defense in depth only)
  - `register.html` / `login.html` — remove client-controlled role; stop storing password in localStorage
- **Libraries/middleware needed:** `express-validator` or `zod` for server-side schemas; optional `express-rate-limit` on login/register
- **Possible side effects:** Frontend must send JWT on all admin API calls; existing unauthenticated scripts or Bruno tests need updating

### Target secure route design

```
POST /category   → verifyToken → requireAdmin → validateInput → controller
POST /platform   → verifyToken → requireAdmin → validateInput → controller
POST /game       → verifyToken → requireAdmin → validateInput → multer → controller
DELETE /game/:id → verifyToken → requireAdmin → controller
POST /users      → validateInput → force type=Customer → hashPassword → controller
POST /users/:uid/game/:gid/review → verifyToken → assert uid === req.userid → validateInput → controller
```

### Role model (should be defined once)

| Role | Assigned by | Allowed actions |
| --- | --- | --- |
| Customer | Server on registration | Browse, review own games |
| Admin | DB seed / manual promotion only | CRUD categories, platforms, games |

## 7. Tools and Methods Used

- Tool/method: Manual code review
  - What I tested: Admin/security flow from login → admin pages → API calls
  - Result: Frontend checks role via `/CheckRole`; backend admin routes have no matching enforcement

- Tool/method: Manual code review
  - What I tested: Registration and role handling across UI, API, and database seed
  - Result: Three different role strings (`user`, `Customer`, `Admin`); no server-side enum

- Tool/method: Manual code review
  - What I tested: Input validation on all POST endpoints
  - Result: Client-side HTML validation only; server accepts arbitrary values

- Tool/method: Bypass test design (documented, not yet executed)
  - What I tested: Seven curl/HTTP cases for frontend-only control bypass (#115)
  - Result: All admin and review controls expected to fail open on direct API access

- Tool/method: npm audit (prior review)
  - What I tested: Backend and frontend dependency trees
  - Result: 9 vulnerabilities each (express, jws, lodash, etc.) — separate from A04 but worth noting

## 8. What I Want To Do Next

- [x] Scout A04 insecure design and validation gaps (#93)
- [x] Trace admin/security design flow (#114)
- [x] Document frontend-only bypass test cases (#115)
- [x] Scout input validation gaps (#116)
- [x] Document insecure design impact (#117)
- [x] Pick detailed and brief A04 candidates (#118)
- [ ] Run bypass tests locally and record pass/fail in Bruno or curl logs
- [ ] Capture screenshots of admin UI lock vs successful API bypass
- [ ] Create proof-of-concept requests for top 3 findings
- [ ] Draft secure-design diagram for Week 1 presentation
- [ ] Coordinate with Nachiketh (A01 overlap on unprotected endpoints)
- [ ] Coordinate with Keefe (A07 overlap on plaintext passwords)
- [ ] Ask teammate to review finding

## 9. Questions / Blockers

- Should admin HTML pages return 403 at the server level, or is hiding links enough for this assignment scope?
- What is the canonical role string — `Customer`, `user`, or something else? Needs team agreement before fixes.
- Backend port in README says 3001 but older code comments say 8081 — confirm which port to use for bypass tests.
- Overlap with Nachiketh's A01 findings (IDOR, no auth) — need to split write-up so A04 focuses on *design* root cause vs implementation.

## 10. Academic Integrity Reminder

Write in your own words. Do not copy another person's finding text. Collaboration is allowed for testing and review, but each person's scouting notes should show their own understanding.
