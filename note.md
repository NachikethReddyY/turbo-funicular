**Proper Demo Flow**

**0. Setup / Launch**
1. Start MySQL and import `spgames_SC.sql` if needed.
2. Start backend:
```bash
cd Assignment/BackEndServer
node server.js
```
Backend API: `http://localhost:8081`

3. Start frontend:
```bash
cd Assignment/FrontEndServer
node server.js
```
Frontend: `http://localhost:3001`

4. Open Bruno collection:
```text
API-Testing/opencollection.yml
```

Use these accounts:
```text
Admin:    John@gmail.com / abc123
Customer: terry@gmail.com / abc123
```

**1. Baseline Login**
Purpose: show normal app usage before attacking.

1. Open frontend: `http://localhost:3001`
2. Login as customer:
```text
terry@gmail.com
abc123
```
3. Show normal user can browse games.
4. In Bruno, run:
```text
09 - Login Admin (John)
```
Body:
```json
{
  "email": "John@gmail.com",
  "password": "abc123"
}
```
5. Copy token if you need authenticated after-fix tests.

This is just setup, not one OWASP finding yet.

**2. A03 — Injection**
What to test: SQL injection through user ID.

Use Bruno request:
```text
19 - SQL Injection - GET /users/1 OR 1=1
```

Or manually:
```http
GET http://localhost:8081/users/1%20OR%201=1
```

Say:
“Here, the user ID is treated as SQL instead of data.”

Expected vulnerable result:
- returns more users than intended, or exposes user records
- may include passwords depending on raw version

Optional login-field wording if teacher expects “type `' OR '1'='1`”:
```text
' OR '1'='1
```
But for your documented app, the stronger evidence is:
```text
/users/1 OR 1=1
```

Fix to explain:
- use parameterized SQL queries with `?`
- validate `userid` as a number
- return generic errors

OWASP label:
```text
A03 — Injection
```

**3. A04 — Insecure Design**
What to test: client controls role/admin design.

Use Bruno request:
```text
08 - Register as Admin - POST /users
```

Body:
```json
{
  "username": "hacker",
  "email": "hacker@test.com",
  "password": "hack",
  "type": "admin",
  "profile_pic_url": ""
}
```

Say:
“The design mistake is that the client can tell the server what role the new user should have.”

Expected vulnerable result:
```text
201 Created
```
Meaning attacker created an admin account.

Also show frontend/admin page if needed:
1. Open admin page.
2. Use DevTools.
3. Remove CSS/hidden/locked class.
4. Explain: “The UI tried to hide admin features, but the backend must enforce admin access.”

Fix to explain:
- server assigns default role
- remove `type` from registration form
- backend `requireAdmin` protects admin actions

OWASP label:
```text
A04 — Insecure Design
```

**4. A01 — Broken Access Control**
What to test: admin endpoints work without proper permission.

Use Bruno request:
```text
12 - Expose All Users (No Auth) - GET /users
```

Manual:
```http
GET http://localhost:8081/users
```

Expected vulnerable result:
- all users returned
- passwords visible in raw version

Then show destructive admin action, only if safe:
```text
14 - Delete Game (No Auth) - DELETE /game/14
```

Manual:
```http
DELETE http://localhost:8081/game/14
```

Say:
“This is broken access control because the server does not check who is calling the route.”

Fix to explain:
- add `verifyToken`
- add `requireAdmin`
- protected routes now return:
```text
401 Unauthorized
403 Forbidden
```

OWASP label:
```text
A01 — Broken Access Control
```

**5. A07 — Authentication Failures**
What to test: weak credential/session handling.

Show evidence, not necessarily a long live exploit.

Option A: API password exposure:
```text
12 - Expose All Users - GET /users
```

Point out:
```json
"password": "abc123"
```

Option B: browser token storage:
1. Login on frontend.
2. Open DevTools.
3. Go to Application → Local Storage.
4. Show token stored in browser storage.

Say:
“If XSS happens, JavaScript can read this token and replay it.”

Option C: hardcoded JWT secret:
Show code/evidence that the old secret was:
```text
Assignment2key
```

Fix to explain:
- bcrypt for passwords
- Cognito Hosted UI + PKCE
- JWKS token verification
- JWT secret from environment / AWS Secrets Manager
- recommended: httpOnly secure cookies

OWASP label:
```text
A07 — Identification and Authentication Failures
```

**6. A09 — Logging & Monitoring Failures**
What to test: unsafe or missing security logs.

First login as admin in Bruno:
```text
09 - Login Admin (John)
```
Copy token into collection auth if needed.

Run:
```text
20 - A09 Username Enumeration
```

Body uses existing username:
```json
{
  "username": "John",
  "email": "john_new@test.com",
  "password": "test123",
  "type": "Customer",
  "profile_pic_url": ""
}
```

Then run:
```text
21 - A09 Email Enumeration
```

Body uses existing email:
```json
{
  "username": "John2",
  "email": "John@gmail.com",
  "password": "test123",
  "type": "Customer",
  "profile_pic_url": ""
}
```

Say:
“In the vulnerable version, different error messages reveal whether username or email exists.”

Then run:
```text
25 - A09 Trigger SQL Error
```

Show backend terminal:
- before fix: raw SQL/internal error details
- after fix: safe structured error only

Fix to explain:
- generic duplicate error message
- `securityLog.js`
- `audit()`
- `safeError()`
- CloudWatch/centralized logging recommended

OWASP label:
```text
A09 — Security Logging and Monitoring Failures
```

**7. Final Re-Test Flow**
After showing raw exploits, repeat quickly on fixed version:

1. `A03`: `/users/1 OR 1=1` no longer dumps users.
2. `A04`: `type: "admin"` is ignored/rejected.
3. `A01`: `/users` or `DELETE /game/14` without admin token returns `401/403`.
4. `A07`: passwords not returned; auth handled through Cognito/JWKS/secrets.
5. `A09`: duplicate registration gives generic error; terminal shows safe structured logs.

**Closing Script**
“Our main learning is that frontend checks are not security. The backend must enforce identity, roles, input safety, and logging. We also learnt that one flaw can chain into another: XSS can steal tokens, weak access control exposes passwords, and poor logging makes attacks hard to investigate.”

**Documents Referenced**
- `Docs/reports/consolidated-report.md`
- `Docs/reports/nachiketh-report-a01.md`
- `Docs/reports/nachiketh-report-a09.md`
- `Docs/reports/mike-report.md`
- `Docs/reports/sitt-report.md`
- `Docs/reports/keefe-report.md`
- `Docs/guides/api-testing.md`
- `API-Testing/README.md`
- `API-Testing/*.yml`
- `Set Up Instructions.txt`
- Evidence folders: `Assets/Nachiketh/`, `Assets/Mike/`, `Assets/Sitt/`
