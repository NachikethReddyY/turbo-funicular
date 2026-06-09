# Project Progress Log

---

## **Title:** Cryptix — Weekly Progress Log
**Updated:** 2026-06-08
**Repo:** [https://github.com/NachikethReddyY/turbo-funicular](https://github.com/NachikethReddyY/turbo-funicular)

## Team

| Person        | Full Name         | GitHub          | Assigned OWASP | Issue                     |
| ------------- | ----------------- | --------------- | -------------- | ------------------------- |
| **Nachiketh** | Nachiketh Reddy Y | NachikethReddyY | A01 + A09      | #124 / #128 / #132 / #136 |
| **Keefe**     | Keefe in 4Tech    | —               | A07            | #125 / #129 / #133 / #137 |
| **Mike**      | Mike Franco Abat  | Mike-Franco     | A03            | #126 / #130 / #134 / #138 |
| **Sitt**      | Sitt              | **SINING-NEO**  | A04            | #127 / #131 / #135 / #139 |

> Each member is responsible for logging their own weekly progress. Nachiketh maintains the parent tracker issues.

## Week 0 (02 Jun – 08 Jun)
**Parent issue:** #120
| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
| --- | --- | --- | --- |
| **Nachiketh** (Nachiketh Reddy Y) — A01 + A09 | Attended team meeting on 02-Jun (see `Meeting/02-Jun-26.md`) where we decided the final five OWASP categories and split ownership. I was assigned A01 (Broken Access Control) and A09 (Security Logging & Monitoring). Mapped all 19 API endpoints by reading through `controller/app.js` line by line — checked each route for `verifyToken` middleware, HTTP method, and input sources (params/body/query). Listed every SQL query across all 5 model files and noted which use parameterized `?` vs string interpolation `${}`. Found 18 candidate security flaws across both categories. For A01: no auth on 13/14 endpoints, IDOR on user data (`GET /users`, `GET /users/:userid` returns passwords), game deletion without ownership, client-supplied `type` field on registration (anyone can register as admin). For A09: zero structured logging anywhere, no audit trail for sensitive operations, no failed-login tracking, 403 denials in `verifyToken.js` are silently dropped. Documented everything in `Docs/week-0-nachiketh-scouting.md` with exploit scouting notes, code evidence (file paths + line numbers for every finding), and fix directions. Set up local dev environment: MySQL + PostgreSQL with `nr` user, imported `spgames_SC.sql` schema, configured single-port server on `:3001` that serves both API and frontend. Installed DataGrip, Bruno, OrbStack, kubectl + K9s. | Finding all 19 endpoints required reading 679 lines of `app.js` manually — there is no OpenAPI spec or route registry so I had to cross-reference every `app.get()`, `app.post()`, and `app.delete()` call manually. Could have missed one if I skimmed too fast. Three SQL queries use string interpolation (`users.js:101`, `game.js:159`, `game.js:305`) but they're surrounded by longer blocks of parameterized queries — easy to miss if you don't check every SQL string individually. The frontend and backend ran on separate ports (3001 and 8081). The frontend server also rejects non-GET requests. Had to modify the backend to serve frontend static files so everything works on one port. Git pager opened `git branch` output in less instead of printing to terminal — fixed with `git config --global pager.branch false`. | **Week 1 goals:** • Write a Bruno PoC request that registers a user with `"type": "admin"` and capture screenshot evidence • Draft fix for `POST /users` — either whitelist `type` to `["Customer", "admin"]` or remove it from the registration endpoint entirely (default new users to `"Customer"`) • Add `verifyToken` middleware to write endpoints first (`POST/DELETE`), then read endpoints exposing sensitive data • Create a logging utility with `winston`/`pino` and add structured log calls to `verifyToken.js` (log denied tokens) and `app.js` (log request method + path + userid) • Coordinate with Keefe on bcrypt hashing — the plaintext passwords in `users` table overlap with his A07 login flow analysis |
| **Keefe** (A07) | Attended the team meeting on 02-Jun and was assigned A07 – Identification and Authentication Failures. Began by investigating how user credentials were stored and processed within the application. Reviewed users.js to understand registration and login workflows and traced how user information was inserted into and retrieved from the database. Examined database tables using MySQL Workbench to verify how credentials were stored and compared database contents with backend logic. Investigated the relationship between configuration files, SQL queries, and authentication mechanisms to understand the complete authentication flow. This groundwork helped identify potential weaknesses and provided the necessary understanding required for future vulnerability assessment. | One of the most difficult challenges was troubleshooting HTTP headers and server responses. The framework often returned generic error messages, making it difficult to determine the root cause of issues. To overcome this, raw database errors were examined during development to identify SQL issues, authentication failures, configuration mistakes, and invalid request headers. This improved debugging efficiency and strengthened understanding of backend systems, HTTP request-response handling, and effective error reporting practices | Inspect JWT config (`auth/verifyToken.js`, `config.js`), trace password storage and login flow, document missing auth protections |
| **Mike** (A03) | Reviewed the backend for SQL injection and mapped all query locations across `model/users.js` and `model/game.js`. Identified the unsafe string-interpolated queries in `GET /users/:userid`, `POST /game`, and the `updateGame()` helper, then documented the findings in `Docs/week-0-mike-scouting.md` and `Docs/report.md`. | No major blockers. The main challenge was separating the few unsafe SQL strings from the parameterized queries so the report only included real A03 sinks. | **Week 1 goals:** Capture a safe proof-of-concept request for the strongest injection points, add screenshots or response evidence |
| **Sitt** (A04) | Attended team meeting on 02-Jun and was assigned **A04 (Insecure Design)** (#127 / #131 / #135 / #139). Synced local repo with `origin/main` (18 commits behind) and ran `pnpm install` for `Assignment/BackEndServer`. Reviewed admin/security flow across `admin.html`, `addNewCategory.html`, `addNewPlatform.html`, `addNewGame.html`, and `controller/app.js`. Found that admin access is enforced only in frontend JavaScript (`checkAdmin()` → `GET /CheckRole`), while backend admin routes (`POST /category`, `/platform`, `/game`, `DELETE /game/:id`) have no `verifyToken` or role checks. Identified 12 A04 candidate flaws including client-controlled `type` on registration, inconsistent role values (`user` / `Customer` / `Admin`), missing server-side input validation, remember-me storing plaintext password in `localStorage`, and review endpoint trusting URL `uid` instead of JWT. Documented seven frontend-only bypass test cases (curl/HTTP) and validation gap matrix. Wrote full scouting report in `Docs/week-0-sitt-scouting.md` following the team template, with exploit notes, code evidence, fix direction, and secure route design target. | On Windows, lowercase `docs/` and uppercase `Docs/` are the same folder — had to keep the report in `Docs/` to match the repo and avoid overwriting team files during `git pull`. Backend port is inconsistent: older assignment code references `:8081` but updated README/setup uses a single server on `:3001` — need team confirmation before running bypass tests. Several findings overlap with Nachiketh's A01 (unprotected endpoints, IDOR) and Keefe's A07 (plaintext passwords) — need to frame write-ups around **design root cause** (missing server-side controls by architecture) rather than duplicate their implementation-focused findings. Bypass tests are documented but not yet executed locally — still need MySQL running and servers started to capture actual pass/fail results. | **Week 1 goals:** • Run all seven bypass test cases (TC-01–TC-07) against local API and record results • Capture screenshots: admin UI lock vs successful direct API bypass • Create Bruno/curl PoC for top 3 findings (open POST /category, register as Admin, review IDOR) • Draft secure-design middleware chain (`verifyToken` → `requireAdmin` → `validateInput`) for admin routes • Agree canonical role enum with team (`Customer` vs `user` vs `Admin`) • Coordinate with Nachiketh on A01 overlap and Keefe on password/session design |

## Week 1 (09 Jun – 15 Jun)
**Parent issue:** #121
| Person                            | What Was Done | Issues Faced | Plan to Improve / Fix |
| --------------------------------- | ------------- | ------------ | --------------------- |
| **Nachiketh** (Nachiketh Reddy Y) |               |              |                       |
| **Keefe** (Keefe in 4Tech)        |               |              |                       |
| **Mike** (Mike Franco Abat)       |               |              |                       |
| **Sitt**                          |               |              |                       |

## Week 2 (16 Jun – 22 Jun)
**Parent issue:** #122
| Person                            | What Was Done | Issues Faced | Plan to Improve / Fix |
| --------------------------------- | ------------- | ------------ | --------------------- |
| **Nachiketh** (Nachiketh Reddy Y) |               |              |                       |
| **Keefe** (Keefe in 4Tech)        |               |              |                       |
| **Mike** (Mike Franco Abat)       |               |              |                       |
| **Sitt**                          |               |              |                       |

## Week 3 (23 Jun – 29 Jun)
**Parent issue:** #123
| Person                            | What Was Done | Issues Faced | Plan to Improve / Fix |
| --------------------------------- | ------------- | ------------ | --------------------- |
| **Nachiketh** (Nachiketh Reddy Y) |               |              |                       |
| **Keefe** (Keefe in 4Tech)        |               |              |                       |
| **Mike** (Mike Franco Abat)       |               |              |                       |
| **Sitt**                          |               |              |                       |
