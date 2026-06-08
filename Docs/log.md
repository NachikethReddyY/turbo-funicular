# Project Progress Log

---
**Title:** Cryptix — Weekly Progress Log
**Updated:** 2026-06-08
---

## Week 0 (02 Jun – 08 Jun)

### Nachiketh (A01 — Broken Access Control, A09 — Logging & Monitoring)

**What Was Done**

- Mapped all 19 API endpoints by reading through `controller/app.js` line by line. Each route was checked for `verifyToken` middleware, its HTTP method logged, and whether it accepted user input from params/body/query.
- Listed every SQL query across `model/users.js`, `model/game.js`, `model/review.js`, `model/platform.js`, `model/category.js` — noting whether each used parameterized `?` placeholders or direct string interpolation with `${}`.
- Identified 18 candidate flaws spanning A01 (no auth on 13/14 endpoints, IDOR on user data, games, reviews, client-supplied admin registration) and A09 (zero structured logging, no audit trail, no failed-login tracking).
- Created `Docs/week-0-nachiketh-scouting.md` using the team template with exploit scouting notes, code evidence (file paths + line numbers), and fix directions.
- Set up the local dev environment: MySQL + PostgreSQL with a dedicated `nr` user, imported the `spgames_SC.sql` schema, configured the backend `.env`, and verified the API responds on `http://localhost:3001`.
- Installed tooling: DataGrip (database GUI), Bruno (API testing), OrbStack (Docker replacement), kubectl + K9s (K8s). Added zsh aliases for quick access.

**Issues Faced**

- **Understanding the request flow:** The frontend and backend started as separate servers on different ports (3001 and 8081). The frontend's `server.js` also rejects non-GET requests, so API calls couldn't be proxied through it. Had to modify the backend's `server.js` to serve both the backend API and the frontend's static files under a single port (3001).
- **Mapping 19 endpoints manually:** There was no OpenAPI spec or route list — every endpoint had to be discovered by reading through 679 lines of `app.js`. Could have missed routes that were conditionally registered. Mitigated by cross-referencing every `app.get/post/delete` call against the list.
- **SQL injection identification required careful reading:** Most queries use parameterized `?` placeholders, but three use direct string interpolation (`users.js:101`, `game.js:159`, `game.js:305`). These were easy to spot once I knew to look for `${}` inside SQL strings, but the surrounding code (64 lines around line 159) made them easy to gloss over.
- **Database credentials in `.gitignore`:** The `.env` files with DB passwords couldn't be committed. Had to create `.env.example` templates instead and document the setup process.
- **Git pager annoyance:** Running `git branch` opened a less pager instead of printing to the terminal. Resolved with `git config --global pager.branch false`.

**Detailed Finding Walkthrough — IDOR on User Registration (`POST /users`)**

While reading `controller/app.js:247-302`, I noticed the `POST /users` endpoint accepts a `type` field from the request body with no validation:

```js
app.post('/users', function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var type = req.body.type;                     // ← client-controlled
    ...
    userDB.insertUser(username, email, password, type, ...);
});
```

The `type` column in the `users` table stores the user's role (e.g., `"Customer"` or `"admin"`). There is no server-side check limiting it to predefined values. This means any unauthenticated user can register themselves as an administrator by simply sending `"type": "admin"` in the POST body.

The difficulty here was confirming that the backend never validates or sanitizes this field. I traced through `model/users.js:52-82` — the `insertUser` function passes `type` straight into the SQL `INSERT` statement as a `?` parameter with no filtering before or after. No middleware, no whitelist, no enum check.

**Plan to Improve / Fix (Week 1)**

- Write a proof-of-concept Bruno request that registers a user with `"type": "admin"` and captures the response + screenshot.
- Draft a fix for `controller/app.js` that rejects requests where `type` is not in an allowlist (e.g., `["Customer", "admin"]`), or better, removes `type` from the registration endpoint entirely and defaults all new users to `"Customer"`. Admin creation should be a separate protected endpoint.
- Add `verifyToken` middleware incrementally — start with write endpoints (`POST/DELETE`), then read endpoints that expose sensitive data.
- For A09: create a logging utility module using `winston` or `pino` and add structured log calls to `verifyToken.js` (log denied tokens) and `controller/app.js` (log each request with method, path, userid).
- Coordinate with Keefe on A02 (plaintext passwords) — suggest bcrypt hashing since the password field already overlaps with his A07 login flow analysis.

---

### Keefe (A07 — Authentication Failures)

**What Was Done** — Not yet started. Issues #109–#113 remain open.

**Issues Faced** — N/A

**Plan to Improve / Fix**

- Inspect JWT configuration (`auth/verifyToken.js` and `config.js`)
- Trace password storage and the login flow in `model/users.js:loginUser`
- Document missing auth protections across unprotected routes

---

### Mike (A03 — SQL Injection)

**What Was Done** — Not yet started. Issues #104–#108 remain open.

**Issues Faced** — N/A

**Plan to Improve / Fix**

- List all SQL query locations across model files
- Identify unsafe query construction (string interpolation vs parameterized)
- Safely test SQL injection points
- Capture vulnerable code evidence

---

### Sitt (A04 — Insecure Design)

**What Was Done** — Not yet started. Issues #114–#118 remain open.

**Issues Faced** — N/A

**Plan to Improve / Fix**

- Trace admin/security design flow
- Test frontend-only control bypasses
- Scout input validation gaps
- Document insecure design impact

---

## Week 1 (09 Jun – 15 Jun)

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** | | | |
| **Keefe** | | | |
| **Mike** | | | |
| **Sitt** | | | |

## Week 2 (16 Jun – 22 Jun)

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** | | | |
| **Keefe** | | | |
| **Mike** | | | |
| **Sitt** | | | |

## Week 3 (23 Jun – 29 Jun)

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** | | | |
| **Keefe** | | | |
| **Mike** | | | |
| **Sitt** | | | |
