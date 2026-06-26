# Post-Fix Screenshots — A01 & A09

Use this when the **code fixes are already applied** and you need the **after** evidence for the report appendix.

**Report (before-fix + narrative):** [../reports/nachiketh-report.md](../reports/nachiketh-report.md)  
**Save all images below to:**

```
Assets/Nachiketh/a01-after/    ← A01 post-fix
Assets/Nachiketh/a09-after/    ← A09 post-fix
```

---

## One-time setup

```bash
cd Assignment/BackEndServer
npm start
# → Running on http://localhost:8081
```

**Bruno:** open `API-Testing/opencollection.yml`

### Login accounts

| User | Email | Password | Role | Use for |
|------|-------|----------|------|---------|
| **John** | `John@gmail.com` | `abc123` | Admin | Admin routes, register, delete, GET /users, SQL tests |
| **Terry** | `terry@gmail.com` | `abc123` | Customer | Impersonation block test (A09) |
| Alex | `Alex@gmail.com` | `abc123` | Customer | Optional login demo (A01) |

### How to set Bearer token in Bruno

**Admin token (most tests):**

1. Run **`09 - Login Admin (John)`**
2. Copy `"token"` from response
3. Collection → **Auth** → **Bearer Token** → paste
4. Other requests with `auth: inherit` use this automatically

**Customer token (A09 impersonate test only):**

1. Edit **`09`** body to Terry’s email (or duplicate request)
2. Send → copy Terry’s token
3. On **`15`** only: paste Terry’s token (Collection auth **or** request-level Bearer)

**No token:**

1. Collection → Auth → **No Auth**
2. Send request

---

# Part A — A01 post-fix (`Assets/Nachiketh/a01-after/`)

## A01 — Bruno only (5 screenshots)

| # | Save as | Bruno file | Auth | Expected result |
|---|---------|------------|------|-----------------|
| 1 | `403-no-token.png` | **`14 - Delete Game`** | **No auth** | **403** `Not authorized!` |
| 2 | `403-customer-token.png` | **`12 - Expose All Users`** | **Terry** token | **403** `Admin access required!` |
| 3 | `200-admin-users.png` | **`12 - Expose All Users`** | **John** token | **200** — user list **without** `password` field |
| 4 | `sqli-blocked.png` | **`19 - SQL Injection`** | **John** token | **200** empty/wrong data — **not** all users |
| 5 | `403-register-no-auth.png` | **`08 - Register as Admin`** | **No auth** | **403** (cannot create users without admin) |

**Copy-paste Bruno names:**

```
14 - Delete Game (No Auth) - DELETE /game/14 (VULNERABILITY)
12 - Expose All Users (No Auth) - GET /users (VULNERABILITY)
19 - SQL Injection - GET /users/1 OR 1=1 (VULNERABILITY)
08 - Register as Admin - POST /users (VULNERABILITY)
09 - Login Admin (John) — run first, copy token for #2–4
```

### A01 — Bruno order (fastest)

1. Auth **off** → **`14`** → screenshot → `403-no-token.png`
2. Auth **off** → **`08`** → screenshot → `403-register-no-auth.png`
3. Run **`09`** (John) → set Collection Bearer
4. **`12`** with John → screenshot JSON (no passwords) → `200-admin-users.png`
5. Clear auth → run **`12`** with Terry token (re-login **`09`** as Terry) → `403-customer-token.png`
6. John token again → **`19`** → `sqli-blocked.png`

---

## A01 — Code only (3 screenshots, optional but good for report)

| Save as | File | Highlight lines |
|---------|------|-----------------|
| `code-requireAdmin.png` | `Assignment/BackEndServer/auth/requireAdmin.js` | **1–7** (full file) |
| `code-auth-middleware.png` | `Assignment/BackEndServer/controller/app.js` | **14–15** (`verifyToken`, `requireAdmin` imports) |
| `code-env-secret.png` | `Assignment/BackEndServer/config.js` | **1–6** — blur `JWT_SECRET` value in `.env` if visible |

**No frontend screenshot required for A01 post-fix** — server now enforces auth even if `admin.html` CSS lock still exists client-side.

---

## A01 — Frontend (optional, only if report mentions UI)

| Save as | What |
|---------|------|
| `frontend-admin-still-locked.png` | Open `http://localhost:8081` or frontend URL → `admin.html` as Customer → UI still shows lock (proves UI ≠ security) |

Skip if short on time — Bruno 403 shots are enough.

---

# Part B — A09 post-fix (`Assets/Nachiketh/a09-after/`)

## A09 — Bruno + terminal (5 screenshots)

| # | Save as | Bruno file | Auth | Screenshot what |
|---|---------|------------|------|-----------------|
| 1 | `audit-login-terminal.png` | **`09 - Login Admin (John)`** | No auth on login | **Backend terminal** — JSON line with `"action":"login_success"` |
| 2 | `audit-register-terminal.png` | **`24 - A09 Register User`** | **John** token | **Terminal** — `"action":"user_registered"` after Bruno success |
| 3 | `safe-error-terminal.png` | **`25 - A09 Trigger SQL Error`** | **John** token | **Terminal** — `{"level":"error","message":"..."}` only — **no** full SQL stack |
| 4 | `generic-duplicate.png` | **`20 - A09 Username Enumeration`** | **John** token | **Bruno** — **422** with `"The requested resource already exists."` |
| 5 | `impersonate-blocked.png` | **`15 - Impersonate Review`** | **Terry** token | **Bruno** — **403** `Not authorized!` on `POST /users/3/game/12/review` |

**Copy-paste Bruno names:**

```
09 - Login Admin (John) — run first, copy token
24 - A09 Register User (screenshot backend terminal)
25 - A09 Trigger SQL Error (screenshot backend terminal)
20 - A09 Username Enumeration - POST /users
15 - Impersonate Review - POST /users/3/game/12/review (VULNERABILITY)
```

### A09 — Bruno order (fastest)

1. Terminal visible next to Bruno
2. **`09`** John → screenshot **terminal** → `audit-login-terminal.png`
3. Set John Bearer on collection
4. **`24`** → screenshot **terminal** → `audit-register-terminal.png`
5. **`25`** → screenshot **terminal** → `safe-error-terminal.png`
6. **`20`** (duplicate username `John`) → screenshot **Bruno response** → `generic-duplicate.png`
7. Re-login **`09`** as **Terry** → set Terry Bearer
8. **`15`** → screenshot **Bruno 403** → `impersonate-blocked.png`

**Optional extra:** run **`21 - A09 Email Enumeration`** — should show the **same** generic message as #4 (proves email/username enumeration fixed).

---

## A09 — Code only (4 screenshots, optional)

| Save as | File | Highlight lines |
|---------|------|-----------------|
| `code-securityLog.png` | `Assignment/BackEndServer/securityLog.js` | **1–18** (full file) |
| `code-login-audit.png` | `Assignment/BackEndServer/controller/app.js` | **132–156** (`login_success` / `login_failed`) |
| `code-duplicate-msg.png` | `Assignment/BackEndServer/controller/app.js` | **18** (`DUPLICATE_MSG`) + **267–274** (generic 422 send) |
| `code-review-ownership.png` | `Assignment/BackEndServer/controller/app.js` | **549–559** (userid check before insert) |

**No frontend screenshot required for A09 post-fix.**

---

# Master checklist

## A01 — `Assets/Nachiketh/a01-after/`

**Bruno (required):**

- [ ] `403-no-token.png` ← **`14`**, no auth
- [ ] `403-customer-token.png` ← **`12`**, Terry token
- [ ] `200-admin-users.png` ← **`12`**, John token
- [ ] `sqli-blocked.png` ← **`19`**, John token
- [ ] `403-register-no-auth.png` ← **`08`**, no auth

**Code (optional):**

- [ ] `code-requireAdmin.png`
- [ ] `code-auth-middleware.png`
- [ ] `code-env-secret.png`

**Frontend (optional):**

- [ ] `frontend-admin-still-locked.png`

---

## A09 — `Assets/Nachiketh/a09-after/`

**Bruno + terminal (required):**

- [ ] `audit-login-terminal.png` ← **`09`**, terminal
- [ ] `audit-register-terminal.png` ← **`24`**, terminal
- [ ] `safe-error-terminal.png` ← **`25`**, terminal
- [ ] `generic-duplicate.png` ← **`20`**, Bruno
- [ ] `impersonate-blocked.png` ← **`15`**, Terry token, Bruno

**Code (optional):**

- [ ] `code-securityLog.png`
- [ ] `code-login-audit.png`
- [ ] `code-duplicate-msg.png`
- [ ] `code-review-ownership.png`

---

## When done

1. Drop PNGs in the folders above
2. Tell the agent to wire `a01-after/` and `a09-after/` images into [nachiketh-report.md](../reports/nachiketh-report.md) appendix
3. Submit `Docs/reports/nachiketh-report.md` + `Assets/Nachiketh/`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Admin access required!` | You used Terry — switch to **John** token |
| `Not authorized!` | Token missing/expired — re-run **`09`** |
| No audit line in terminal | Restart `npm start` after code changes |
| `15` still returns 201 | Using John token or URL `/users/1/...` — use **Terry** + **`/users/3/...`** |
| `24` returns 500 | Include `"profile_pic_url": ""` in body |
