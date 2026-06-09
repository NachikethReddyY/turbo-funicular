# Project Progress Log

---
**Title:** Cryptix — Weekly Progress Log
**Updated:** 2026-06-08
**Repo:** https://github.com/NachikethReddyY/turbo-funicular
---

## Team

| Person | Full Name | GitHub | Assigned OWASP | Issue |
|--------|-----------|--------|----------------|-------|
| **Nachiketh** | Nachiketh Reddy Y | NachikethReddyY | A01 + A09 | #124 / #128 / #132 / #136 |
| **Keefe** | Keefe in 4Tech | — | A07 | #125 / #129 / #133 / #137 |
| **Mike** | Mike Franco Abat | — | A03 | #126 / #130 / #134 / #138 |
| **Sitt** | Sitt | — | A04 | #127 / #131 / #135 / #139 |

> Each member is responsible for logging their own weekly progress. Nachiketh maintains the parent tracker issues.

## Week 0 (02 Jun – 08 Jun)
**Parent issue:** #120

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** (Nachiketh Reddy Y) — A01 + A09 | Attended team meeting on 02-Jun (see `Meeting/02-Jun-26.md`) where we decided the final five OWASP categories and split ownership. I was assigned A01 (Broken Access Control) and A09 (Security Logging & Monitoring).<br><br>Mapped all 19 API endpoints by reading through `controller/app.js` line by line — checked each route for `verifyToken` middleware, HTTP method, and input sources (params/body/query). Listed every SQL query across all 5 model files and noted which use parameterized `?` vs string interpolation `${}`.<br><br>Found 18 candidate security flaws across both categories. For A01: no auth on 13/14 endpoints, IDOR on user data (`GET /users`, `GET /users/:userid` returns passwords), game deletion without ownership, client-supplied `type` field on registration (anyone can register as admin). For A09: zero structured logging anywhere, no audit trail for sensitive operations, no failed-login tracking, 403 denials in `verifyToken.js` are silently dropped.<br><br>Documented everything in `Docs/week-0-nachiketh-scouting.md` with exploit scouting notes, code evidence (file paths + line numbers for every finding), and fix directions.<br><br>Set up local dev environment: MySQL + PostgreSQL with `nr` user, imported `spgames_SC.sql` schema, configured single-port server on `:3001` that serves both API and frontend. Installed DataGrip, Bruno, OrbStack, kubectl + K9s. | Finding all 19 endpoints required reading 679 lines of `app.js` manually — there is no OpenAPI spec or route registry so I had to cross-reference every `app.get()`, `app.post()`, and `app.delete()` call manually. Could have missed one if I skimmed too fast.<br><br>Three SQL queries use string interpolation (`users.js:101`, `game.js:159`, `game.js:305`) but they're surrounded by longer blocks of parameterized queries — easy to miss if you don't check every SQL string individually.<br><br>The frontend and backend ran on separate ports (3001 and 8081). The frontend server also rejects non-GET requests. Had to modify the backend to serve frontend static files so everything works on one port.<br><br>Git pager opened `git branch` output in less instead of printing to terminal — fixed with `git config --global pager.branch false`. | **Week 1 goals:**<br>• Write a Bruno PoC request that registers a user with `"type": "admin"` and capture screenshot evidence<br>• Draft fix for `POST /users` — either whitelist `type` to `["Customer", "admin"]` or remove it from the registration endpoint entirely (default new users to `"Customer"`)<br>• Add `verifyToken` middleware to write endpoints first (`POST/DELETE`), then read endpoints exposing sensitive data<br>• Create a logging utility with `winston`/`pino` and add structured log calls to `verifyToken.js` (log denied tokens) and `app.js` (log request method + path + userid)<br>• Coordinate with Keefe on bcrypt hashing — the plaintext passwords in `users` table overlap with his A07 login flow analysis |
| **Keefe** (A07) | Attended the team meeting on 02-Jun and was assigned A07 – Identification and Authentication Failures. Began by investigating how user credentials were stored and processed within the application. Reviewed users.js to understand registration and login workflows and traced how user information was inserted into and retrieved from the database. Examined database tables using MySQL Workbench to verify how credentials were stored and compared database contents with backend logic. Investigated the relationship between configuration files, SQL queries, and authentication mechanisms to understand the complete authentication flow. This groundwork helped identify potential weaknesses and provided the necessary understanding required for future vulnerability assessment. | One of the most difficult challenges was troubleshooting HTTP headers and server responses. The framework often returned generic error messages, making it difficult to determine the root cause of issues. To overcome this, raw database errors were examined during development to identify SQL issues, authentication failures, configuration mistakes, and invalid request headers. This improved debugging efficiency and strengthened understanding of backend systems, HTTP request-response handling, and effective error reporting practices | Inspect JWT config (`auth/verifyToken.js`, `config.js`), trace password storage and login flow, document missing auth protections |
| **Mike** (A03) | — | — | List all SQL query locations across model files, identify unsafe query patterns, safely test injection points, capture evidence |
| **Sitt** (A04) | — | — | Trace admin/security design flow, test frontend-only control bypasses, scout input validation gaps, document impact |

## Week 1 (09 Jun – 15 Jun)
**Parent issue:** #121

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** (Nachiketh Reddy Y) | | | |
| **Keefe** (Keefe in 4Tech) | | | |
| **Mike** (Mike Franco Abat) | | | |
| **Sitt** | | | |

## Week 2 (16 Jun – 22 Jun)
**Parent issue:** #122

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** (Nachiketh Reddy Y) | | | |
| **Keefe** (Keefe in 4Tech) | | | |
| **Mike** (Mike Franco Abat) | | | |
| **Sitt** | | | |

## Week 3 (23 Jun – 29 Jun)
**Parent issue:** #123

| Person | What Was Done | Issues Faced | Plan to Improve / Fix |
|--------|--------------|--------------|-----------------------|
| **Nachiketh** (Nachiketh Reddy Y) | | | |
| **Keefe** (Keefe in 4Tech) | | | |
| **Mike** (Mike Franco Abat) | | | |
| **Sitt** | | | |
