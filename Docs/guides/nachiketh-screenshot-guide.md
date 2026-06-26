# Nachiketh — Screenshot Guide (A01 + A09)

Your evidence for **Broken Access Control (A01)** and **Security Logging & Monitoring (A09)**. Use this as the single checklist; wire images into:

- [nachiketh-report-a01.md](../reports/nachiketh-report-a01.md)
- [nachiketh-report-a09.md](../reports/nachiketh-report-a09.md)

**After-fix only (detailed steps):** [postfix-screenshots.md](postfix-screenshots.md)

---

## Quick status

| Phase | Folder | Status |
|-------|--------|--------|
| A01 before-fix | `Assets/Nachiketh/a01/` | **Done** — 14 Bruno/browser + 13 code shots |
| A09 before-fix | `Assets/Nachiketh/a09/` | **Done** — 11 Bruno/terminal + 7 code shots |
| A01 after-fix | `Assets/Nachiketh/a01-after/` | **Pending** — 5 Bruno (+ 3 optional code) |
| A09 after-fix | `Assets/Nachiketh/a09-after/` | **Pending** — 5 Bruno/terminal (+ 3 optional code) |

---

## One-time setup

```bash
cd Assignment/BackEndServer
npm start
# → Running on http://localhost:8081
```

**Bruno:** open `API-Testing/opencollection.yml`

| User | Email | Password | Role | Use for |
|------|-------|----------|------|---------|
| **John** | `John@gmail.com` | `abc123` | Admin | Admin routes, register, delete, GET /users |
| **Terry** | `terry@gmail.com` | `abc123` | Customer | Customer-only tests (403 / impersonation) |
| Alex | `Alex@gmail.com` | `abc123` | Customer | Optional login demo (A01 Finding 2) |

**Bearer token:** run `09 - Login Admin (John)` → copy `token` → Collection **Auth** → **Bearer Token** → paste. Requests with `auth: inherit` pick it up automatically.

---

## Folder layout

```
Assets/Nachiketh/
├── a01/              ← before-fix A01 (exploits work)
├── a01-after/        ← after-fix A01 (403 / blocked)
├── a09/              ← before-fix A09 (no audit, leaks, enum)
└── a09-after/        ← after-fix A09 (audit lines, safe errors)
```

**Screenshot tips**

- **Bruno:** capture request + response (status code + JSON body visible).
- **Terminal:** backend window beside Bruno; show stdout after the action.
- **Code (VS Code):** highlight the vulnerable/fixed lines; blur `.env` secrets if visible.
- **Browser:** DevTools open; show Elements panel when bypassing CSS lock.

---

# Part 1 — A01 before-fix (`Assets/Nachiketh/a01/`)

Capture these **before** auth middleware fixes (or from git history if re-staging). Most are already in the repo.

## Finding 1 — Missing authentication & authorisation

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `01 -APITesting.png` | Bruno | Collection overview | Endpoints with no `Authorization` header |
| `09-Admin URLs.png` | Bruno | Admin-related requests listed | Sensitive routes exposed in collection |
| `11-Brunocancreate an account ad admon.png` | Bruno | **`08 - Register as Admin`** — no auth | **201** — user created with `"type": "admin"` |
| `12-Anyonecandeletegames.png` | Bruno | **`14 - Delete Game`** — no auth | **204** — game deleted without token |
| `10 - Insecure Browser tools.png` | Browser | `admin.html` as Customer → DevTools | Remove CSS `locked` class → admin UI unlocks |

**Code (`a01/code/`):** unprotected routes in `controller/app.js`

| Save as | Lines | What to show |
|---------|-------|--------------|
| `controller_app.js-_216-241.png` | 216–241 | `GET /users` — no middleware |
| `controller_app.js-_244-302.png` | 244–302 | `POST /users` — client `type` |
| `controller_app.js-_305-331.png` | 305–331 | `GET /users/:userid` — no auth |
| `controller_app.js-_334-381.png` | 334–381 | `POST /category` — no auth |
| `controller_app.js-_384-429.png` | 384–429 | `POST /platform` — no auth |
| `controller_app.js-_432-495.png` | 432–495 | `POST /game` — no auth |
| `controller_app.js-_526-551.png` | 526–551 | `DELETE /game/:id` — no auth |
| `controller_app.js-_554-582.png` | 554–582 | `POST .../review` — no ownership check |
| `controller_app.js-_123-153.png` | 123–153 | Login error leakage (if in report) |

## Finding 2 — Plaintext password exposure

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `02 - ExposedUsersOnPort8001.png` | Bruno | **`12 - Expose All Users`** — no auth | **200** — full user list |
| `03 - PasswordsUnhashed.png` | Bruno | Same response, zoom JSON | `password` field readable (e.g. `abc123`) |
| `04 - LogInasAlex.png` | Bruno | **`09 - Login`** as Alex | Login works with exposed creds |
| `05 - ExposedPassword.png` | Bruno | Alex row in GET /users | Password matches login |
| `13-Exposure.png` | Bruno | User record detail | userid, email, password, role together |

**Code**

| Save as | File | What to show |
|---------|------|--------------|
| `model/user.js :28.png` | `model/users.js` ~28 | `SELECT` includes `password` |
| `model/user.js :123-171.png` | `model/users.js` 123–171 | Plaintext compare in `loginUser` |

## Finding 3 — SQL injection

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `14-SQL Injection.png` | Bruno | **`19 - SQL Injection`** | **200** with extra rows / all users from `1 OR 1=1` |

**Code**

| Save as | File | What to show |
|---------|------|--------------|
| `model/user.js :100-116.png` | `model/users.js` | `${userid}` string interpolation |
| `model/game.js :144-176.png` | `model/game.js` | `${title}` etc. in `insertGame` |
| `model/game.js :291-322.png` | `model/game.js` | `${}` in `updateGame` |

## Finding 4 — Hardcoded JWT secret

| Save as | Tool | Action | What to show |
|---------|------|--------|--------------|
| `05.1 - GettingJWT.png` | Bruno | **`09 - Login`** | Legitimate token in response |
| `06 - Changing JWT.png` | jwt.io / Bruno | Forge token with `type: admin` | Signed with known secret |
| `07 - JWTChangeAccepted.png` | Bruno | Call protected route with forged token | **200** — forged token accepted |

**Code**

| Save as | File | What to show |
|---------|------|--------------|
| `model/config.js.png` | `config.js` (old) | Hardcoded `'Assignment2key'` |
| `model/verify.js.png` | `auth/verifyToken.js` | Verifies with `config.key` |

### A01 before-fix checklist

- [x] Finding 1 — Bruno (5) + code (9)
- [x] Finding 2 — Bruno (5) + code (2)
- [x] Finding 3 — Bruno (1) + code (3)
- [x] Finding 4 — Bruno (3) + code (2)

---

# Part 2 — A01 after-fix (`Assets/Nachiketh/a01-after/`)

**Pending.** Re-run with **fixes applied**. Same Bruno files; expect blocked/different behaviour.

| Save as | Bruno file | Auth | Expected |
|---------|------------|------|----------|
| `403-no-token.png` | **`14 - Delete Game`** | None | **403** `Not authorized!` |
| `403-register-no-auth.png` | **`08 - Register as Admin`** | None | **403** |
| `403-customer-token.png` | **`12 - Expose All Users`** | **Terry** token | **403** `Admin access required!` |
| `200-admin-users.png` | **`12 - Expose All Users`** | **John** token | **200** — no `password` in JSON |
| `sqli-blocked.png` | **`19 - SQL Injection`** | **John** token | Safe result — not all users |

**Optional code:** `code-requireAdmin.png`, `code-auth-middleware.png`, `code-env-secret.png`

**Order:** see [postfix-screenshots.md § A01](postfix-screenshots.md#part-a--a01-post-fix-assetsnachiketha01-after)

### A01 after-fix checklist

- [ ] `403-no-token.png`
- [ ] `403-register-no-auth.png`
- [ ] `403-customer-token.png`
- [ ] `200-admin-users.png`
- [ ] `sqli-blocked.png`

---

# Part 3 — A09 before-fix (`Assets/Nachiketh/a09/`)

Capture with **A01 fixes already in place** but **before** `securityLog.js` / generic errors / review ownership.

## No audit trail

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `24 terminal.png` | Terminal | After **`24 - A09 Register User`** | Only startup banner — **no** audit JSON line |
| `24.png` | Bruno | **`24 - A09 Register User`** | **201** registration success |

## SQL / error leakage

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `25 error.png` | Terminal | After **`25 - A09 Trigger SQL Error`** | Full `ER_*` SQL error in stdout |
| `25.png` | Bruno | **`25 - A09 Trigger SQL Error`** | Request that caused the error |

## Username / email enumeration

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `username dupe.png` | Bruno | Duplicate username on register | `"Username already exists"` (or similar) |
| `email dupe.png` | Bruno | Duplicate email, new username | `"Email already exists"` — **different** message |
| `20.png` | Bruno | **`20 - A09 Username Enumeration`** | Same as username dupe |
| `21.png` | Bruno | **`21 - A09 Email Enumeration`** | Same as email dupe |
| `22.png` | Bruno | **`22 - A09 Enumeration Contrast`** | New user — third distinct response shape |

## Review impersonation

| Save as | Tool | Bruno / action | What to show |
|---------|------|----------------|--------------|
| `bearer.png` | Bruno | **`09 - Login`** (Terry) + Bearer setup | Terry's token on collection |
| `15.png` | Bruno | **`15 - Impersonate Review`** — Terry token, URL `/users/3/game/12/review` | **201** — review posted as another user |

**Code (`a09/code/`)**

| Save as | File (approx.) | What to show |
|---------|----------------|--------------|
| `app 226-228.png` | `controller/app.js` | `console.log(err)` on error path |
| `app 268,278.png` | `controller/app.js` | `console.log(err)` on duplicate paths |
| `app 272, 282.png` | `controller/app.js` | Distinct username vs email messages |
| `app 359.png` | `controller/app.js` | Category duplicate message |
| `app 409.png` | `controller/app.js` | Platform duplicate message |
| `user 131 143 153,154.png` | `model/users.js` | Error logging on login |
| `verifyTocken 17.png` | `auth/verifyToken.js` | Commented / removed token log |

### A09 before-fix checklist

- [x] No audit — terminal + Bruno (2)
- [x] SQL error leak — terminal + Bruno (2)
- [x] Enumeration — Bruno (5)
- [x] Impersonation — Bruno (2)
- [x] Code evidence (7)

---

# Part 4 — A09 after-fix (`Assets/Nachiketh/a09-after/`)

**Pending.** With `securityLog.js`, generic duplicate message, and review ownership check.

| Save as | Bruno file | Auth | Screenshot what |
|---------|------------|------|-----------------|
| `audit-login-terminal.png` | **`09 - Login Admin (John)`** | — | Terminal: `"action":"login_success"` JSON line |
| `audit-register-terminal.png` | **`24 - A09 Register User`** | John | Terminal: `"action":"user_registered"` |
| `safe-error-terminal.png` | **`25 - A09 Trigger SQL Error`** | John | Terminal: short `{"level":"error","message":"..."}` only |
| `generic-duplicate.png` | **`20 - A09 Username Enumeration`** | John | Bruno: **422** + generic `"The requested resource already exists."` |
| `impersonate-blocked.png` | **`15 - Impersonate Review`** | **Terry** | Bruno: **403** on `/users/3/game/12/review` |

**Optional:** run **`21 - A09 Email Enumeration`** — same generic message as #20.

**Optional code:** `code-securityLog.png`, `code-duplicate-msg.png`, `code-review-ownership.png`

**Order:** see [postfix-screenshots.md § A09](postfix-screenshots.md#part-b--a09-post-fix-assetsnachiketha09-after)

### A09 after-fix checklist

- [ ] `audit-login-terminal.png`
- [ ] `audit-register-terminal.png`
- [ ] `safe-error-terminal.png`
- [ ] `generic-duplicate.png`
- [ ] `impersonate-blocked.png`

---

# Master checklist (submission)

## Must have (already done)

- [x] `Assets/Nachiketh/a01/` — all before-fix A01 evidence
- [x] `Assets/Nachiketh/a09/` — all before-fix A09 evidence
- [x] Reports reference images: [nachiketh-report-a01.md](../reports/nachiketh-report-a01.md), [nachiketh-report-a09.md](../reports/nachiketh-report-a09.md)

## Still to do

- [ ] `Assets/Nachiketh/a01-after/` — 5 Bruno screenshots
- [ ] `Assets/Nachiketh/a09-after/` — 5 Bruno/terminal screenshots
- [ ] Embed after-fix images in report appendix (or new “Verification” section)
- [ ] Update [nachiketh-report.md](../reports/nachiketh-report.md) “Post-Fix Verification” table

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Admin access required!` | Use **John** token, not Terry |
| `Not authorized!` | Re-run **`09 - Login`**, refresh Bearer token |
| `15` still returns 201 after fix | Use **Terry** token + URL `/users/3/...` (not `/users/1/`) |
| No audit line in terminal | Restart `npm start`; confirm `securityLog.js` is loaded |
| `24` returns 500 | Include `"profile_pic_url": ""` in JSON body |
| Before-fix shots impossible now | Use files already in `a01/` and `a09/` — do not revert code |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [postfix-screenshots.md](postfix-screenshots.md) | Step-by-step after-fix capture order |
| [API-Testing/README.md](../../API-Testing/README.md) | Bruno auth setup |
| [api-testing-bruno.md](api-testing-bruno.md) | Full Bruno walkthrough |
| [nachiketh-fixes-tracker.md](../tracking/nachiketh-fixes-tracker.md) | Which code fixes map to which finding |
