# A09 Screenshots — Everything in One Place

**Goal:** Capture evidence of logging/monitoring failures **before any code fixes.**  
**Save everything to:** `Assignment/Assets/Nachiketh/` (and `.../code/` for code shots)  
**Time:** ~30–40 minutes if you follow this in order.

---

## What you're proving (30-second version)

A09 = **Security Logging & Monitoring Failures**. Two issues in this app:

| # | Finding | What a screenshot must show |
|---|---------|------------------------------|
| 1 | **No audit logging** | You do something security-sensitive (register, delete, login) and the **backend terminal shows nothing useful** — no timestamp, user, action, IP |
| 2 | **Information leakage** | SQL errors / tokens / enumeration messages leak details attackers can use |

You do **not** need to read the other A09 docs. This file is the only checklist.

---

## Setup (do once, ~3 min)

```bash
mkdir -p /Users/nr/Developer/turbo-funicular/Assignment/Assets/Nachiketh/code

# From repo root (turbo-funicular/) — use full path if cd fails:
cd /Users/nr/Developer/turbo-funicular/Assignment/BackEndServer

# One-time: create .env (server refuses to start without JWT_SECRET)
cp .env.example .env
# Edit DB_USER / DB_PASSWORD if your MySQL user isn't root/root

npm start
# Expected: Running on http://localhost:8081
```

Leave that terminal visible — **Terminal 1 (backend console)**. You will screenshot it.

Open a second terminal or **Bruno** with collection `API-Testing/opencollection.yml`.

**Bruno A09 requests (pre-made):**

| Bruno file | Purpose |
|------------|---------|
| `24-A09-Register-User.yml` | Register user → no logging shot |
| `25-A09-Trigger-SQL-Error.yml` | SQL error in backend console |
| `20-A09-Username-Enumeration.yml` | Username already exists |
| `21-A09-Email-Enumeration.yml` | Email already exists |
| `22-A09-Enumeration-Contrast.yml` | New user → different response |
| `15-Impersonate-Review-POST.yml` | Impersonation with no audit trail |

**Screenshot shortcut (macOS):** `Cmd+Shift+4` → drag to select area.

---

## Which filenames matter?

There were **two naming schemes** in old docs. Use this table — **“Report filename” wins** for anything already referenced in `nachikethreport.md` Finding 5.

| # | Report filename (use this) | Old alt name (ignore) | Required for report? |
|---|---------------------------|----------------------|----------------------|
| 1 | `08-Consolecoammnd.png` | `08-backend-console-no-logging.png` | **Yes** |
| 2 | `14-SQL Injection.png` | `09-console-sql-error-exposed.png` | **Yes** |
| 3 | `13-Exposure.png` | — | **Yes** (impersonation, cited in Finding 5) |
| 4 | `code/model/verify.js.png` | `code/verifyToken.js-token-logging.png` | **Yes** |
| 5 | `10-enumeration-username-exists.png` | — | Recommended (enumeration evidence) |
| 6 | `11-enumeration-email-exists.png` | — | Recommended |
| 7 | `12-enumeration-username-contrast.png` | — | Recommended |
| 8 | `13-frontend-console-error.png` | — | Recommended (different from #3) |
| 9 | `code/app.js-console-logging-pattern.png` | — | Recommended |
| 10 | `code/users.js-sensitive-logging.png` | — | Recommended |
| 11 | `code/app.js-enumeration-errors.png` | — | Recommended |

**Minimum to unblock the report today:** shots **1–4**.  
**Full A09 evidence set:** all **11**.

---

## Capture order (fastest path)

Work top to bottom. Check each box as you go.

### PART A — Required for `nachikethreport.md` Finding 5

- [ ] **Shot 1 — No audit logging** → `08-Consolecoammnd.png`

  1. Backend running in Terminal 1.
  2. Run Bruno **`24-A09-Register-User.yml`** (or curl below).
  3. Look at Terminal 1 — you should see **no** “user registered”, timestamp, user ID, or IP.
  4. Screenshot Terminal 1 **and** include the Bruno/curl success response if you can fit both; otherwise Terminal 1 alone is fine.

  ```bash
  curl -X POST http://localhost:8081/users \
    -H "Content-Type: application/json" \
    -d '{"username":"newuser123","email":"newuser@example.com","password":"testpass123","type":"Customer","profile_pic_url":""}'
  ```

  **Must be visible:** `Running on http://localhost:8081` + empty/useless console after the POST.

---

- [ ] **Shot 2 — SQL error leaked to console** → `14-SQL Injection.png`

  1. Run Bruno **`25-A09-Trigger-SQL-Error.yml`** (or curl below).
  2. Screenshot Terminal 1 showing the raw error (table/column names, `ER_...` message).

  ```bash
  curl -X POST http://localhost:8081/game \
    -H "Content-Type: application/json" \
    -d '{"title":"","game_description":"test"}'
  ```

  **Must be visible:** Full SQL/database error text in the backend terminal — not a generic JSON error to the client.

---

- [ ] **Shot 3 — Action with no forensic trail** → `13-Exposure.png`

  1. Run Bruno **`15-Impersonate-Review-POST.yml`** (posts a review as another user).
  2. Screenshot Bruno showing **201/200 success** for the impersonated review.
  3. Optionally include Terminal 1 still showing no audit entry (same idea as Shot 1).

  **Must be visible:** Request succeeded impersonating another user; no meaningful server-side audit log.

---

- [ ] **Shot 4 — Token/header logging in code** → `code/model/verify.js.png`

  1. Open `Assignment/BackEndServer/auth/verifyToken.js` in VS Code.
  2. Go to **line 17** — `//console.log(token);`
  3. Screenshot with line numbers visible.

  **Note:** The report path says `code/model/verify.js.png` but the real file is `auth/verifyToken.js`. Save using the **report filename** so markdown links work. Active `console.log(req.headers)` may already be removed; the commented token log still proves the risk existed.

  Also scroll to `Assignment/BackEndServer/model/users.js` **line 154** (`//console.log("@@token " + token);`) — you can include both in one code shot or use Shot 10 below.

---

### PART B — Recommended extra evidence (enumeration + patterns)

- [ ] **Shot 5 — Username enumeration** → `10-enumeration-username-exists.png`

  1. First register `John` once (Bruno **`24`** or any register call with `"username":"John"`).
  2. Run Bruno **`20-A09-Username-Enumeration.yml`** (same username, different email).
  3. Screenshot response body:

  ```json
  {"Message":"The username provided already exists."}
  ```

---

- [ ] **Shot 6 — Email enumeration** → `11-enumeration-email-exists.png`

  1. Run Bruno **`21-A09-Email-Enumeration.yml`**.
  2. Screenshot response:

  ```json
  {"Message":"The email provided already exists."}
  ```

---

- [ ] **Shot 7 — Contrast (proves enumeration works)** → `12-enumeration-username-contrast.png`

  1. Run Bruno **`22-A09-Enumeration-Contrast.yml`** (brand-new username + email).
  2. Screenshot — response should **differ** from “already exists” (success or different error).

  **Tip:** Put Shots 5 and 7 side-by-side in the report to show “exists” vs “new user” messages differ.

---

- [ ] **Shot 8 — Frontend console leakage** → `13-frontend-console-error.png`

  1. Start frontend if needed: `cd Assignment/FrontEndServer && npm start`
  2. Open `http://localhost:3000/admin.html` (or login/register page).
  3. Press **F12** → **Console** tab.
  4. Trigger an error (e.g. open admin while not logged in as admin, failed login, bad form submit).
  5. Screenshot `console.error(...)` output.

  **Code locations if you need them:** `admin.html` ~95, `login.html` ~109, `register.html` ~154.

---

- [ ] **Shot 9 — Repeated `console.log(err)` pattern** → `code/app.js-console-logging-pattern.png`

  Open `Assignment/BackEndServer/controller/app.js`, screenshot these blocks (line numbers may shift ±2):

  - **~78** — GET /users error handler
  - **~106** — login error handler  
  - **~175** — POST /users error handler

  ```javascript
  if (err) {
      console.log(err);
      res.status(500);
      ...
  }
  ```

  One screenshot showing 2–3 occurrences is enough.

---

- [ ] **Shot 10 — Sensitive logging in users.js** → `code/users.js-sensitive-logging.png`

  Open `Assignment/BackEndServer/model/users.js`, screenshot **~131, 143, 154**:

  ```javascript
  console.log(err);
  console.log("Err: " + err);
  //console.log("@@token " + token);
  ```

---

- [ ] **Shot 11 — Enumeration error messages in app.js** → `code/app.js-enumeration-errors.png`

  Open `Assignment/BackEndServer/controller/app.js`, screenshot **~272, 282, 359, 409**:

  ```javascript
  res.send(`{"Message":"The username provided already exists."}`);
  res.send(`{"Message":"The email provided already exists."}`);
  res.send(`{"Message":"The category name provided already exists."}`);
  res.send(`{"Message":"The platform name provided already exists."}`);
  ```

---

## Final folder layout

```
Assignment/Assets/Nachiketh/
├── 08-Consolecoammnd.png              ← Shot 1 (report)
├── 13-Exposure.png                    ← Shot 3 (report)
├── 14-SQL Injection.png               ← Shot 2 (report)
├── 10-enumeration-username-exists.png ← Shot 5
├── 11-enumeration-email-exists.png    ← Shot 6
├── 12-enumeration-username-contrast.png ← Shot 7
├── 13-frontend-console-error.png      ← Shot 8
└── code/
    ├── model/
    │   └── verify.js.png              ← Shot 4 (report path — create model/ subfolder)
    ├── app.js-console-logging-pattern.png
    ├── users.js-sensitive-logging.png
    └── app.js-enumeration-errors.png
```

Create the nested folder for shot 4:

```bash
mkdir -p /Users/nr/Developer/turbo-funicular/Assignment/Assets/Nachiketh/code/model
```

---

## Master checklist

**Report minimum (do these first):**

- [ ] `08-Consolecoammnd.png` — backend console, no audit log after register
- [ ] `14-SQL Injection.png` — backend console, raw SQL error
- [ ] `13-Exposure.png` — impersonation review succeeds in Bruno
- [ ] `code/model/verify.js.png` — verifyToken.js line 17 (+ optional users.js token log)

**Full A09 set:**

- [ ] All 4 above
- [ ] `10-enumeration-username-exists.png`
- [ ] `11-enumeration-email-exists.png`
- [ ] `12-enumeration-username-contrast.png`
- [ ] `13-frontend-console-error.png`
- [ ] `code/app.js-console-logging-pattern.png`
- [ ] `code/users.js-sensitive-logging.png`
- [ ] `code/app.js-enumeration-errors.png`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 8081 in use | `lsof -ti:8081 \| xargs kill -9` then `npm start` again |
| Register returns 500 | Check MySQL/DB is running; try a fresh username/email |
| No SQL error in console | Use POST `/game` with `"title":""` exactly as in Shot 2 |
| Frontend won't load | `cd Assignment/FrontEndServer && npm install && npm start` |
| Bruno can't connect | Backend must show `Running on http://localhost:8081` |

---

## After screenshots → what we do next

1. **You:** Drop PNGs into `Assignment/Assets/Nachiketh/` using filenames above.
2. **Then (code phase):** Remove sensitive logging, add structured audit logs, generic enumeration errors.
3. **Report:** Finding 5 in `Docs/nachikethreport.md` already has the 7-point structure — we wire in screenshots and adjust text if `verifyToken.js` logging is only commented now.

---

## Old docs (you can ignore these)

These were split across multiple files; content is merged here:

- ~~`A09-VISUAL-SUMMARY.md`~~ — background only
- ~~`A09-READY-FOR-SCREENSHOTS.md`~~ — duplicate checklist
- ~~`A09-screenshot-capture-guide.md`~~ — duplicate steps
- ~~`A09-STARTING-POINT.md`~~ — index page
- ~~`A09-scoping-and-findings.md`~~ — full issue inventory (for report writing later)

**Start here. Finish Part A first. Then Part B if you have time.**
