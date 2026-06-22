---
author: Nachiketh Reddy Y
module: ST2515 Secure Coding
date: June 2026
category: OWASP A09 — Security Logging & Monitoring Failures
---

# Security Assessment Report: OWASP A09 — Security Logging & Monitoring Failures

---

## 1. Executive Summary

A security assessment of the game catalogue web application revealed **high-severity logging and monitoring gaps** under OWASP Top 10 2021 category **A09 — Security Logging & Monitoring Failures**. The application treated server stdout as a debug channel rather than a monitored audit surface. Security-relevant events were invisible to defenders, errors leaked database schema details, duplicate-registration responses enabled user enumeration, and review impersonation left no forensic trail.

| Item | Detail |
|------|--------|
| **Risk level** | High |
| **Impact** | Attackers operate undetected; operators cannot reconstruct who did what; error output aids further attacks; enumeration confirms valid accounts |
| **Affected components** | `controller/app.js`, `model/users.js`, `auth/verifyToken.js` |
| **Remediation status** | Fixed via `securityLog.js`, generic duplicate messages, and review ownership validation |

**Cross-cutting note (A01 ↔ A09):** During A09 scoping, `auth/verifyToken.js` was found to log `req.headers` and raw JWT tokens, and `model/users.js` logged tokens on login. Those were **removed in the A01 hardening pass** before A09-specific fixes landed. This report covers the remaining A09 issues.

---

## 2. Vulnerability Description & Flaw Analysis

### Type of Flaw Detected

The application suffers from **Security Logging & Monitoring Failures (A09)** across three distinct issues:

| Issue | Description |
|-------|-------------|
| **No audit logging** | Register, login, delete, and review actions produced no structured forensic record |
| **Information leakage** | `console.log(err)` dumped full SQL errors to stdout; duplicate-registration responses differed for username vs email |
| **Unlogged impersonation** | Any authenticated user could post a review as another user's ID in the URL path |

| Attribute | Value |
|-----------|-------|
| **CVSS 3.1** | 7.5 (High) |

### Mechanism of Action

1. **Silent security events:** Admin actions (register user, delete game, login) completed without a timestamped audit line. An operator watching the terminal could not distinguish normal traffic from abuse.
2. **Debug-grade error output:** Database exceptions were logged with `console.log(err)`, exposing `ER_*` codes, column names, and table structure to anyone with log access.
3. **Distinct enumeration messages:** `"Username already exists"` vs `"Email already exists"` let attackers confirm which identifier is registered.
4. **URL-parameter trust:** `POST /users/:uid/game/:gid/review` used `:uid` from the path without comparing it to the JWT's `userid` claim.

---

## 3. Exploitation Scenario (Proof of Concept)

### Step 1 — No audit trail on registration

An admin registers a user via `POST /users`. The backend terminal showed only the startup banner — no timestamp, actor, or action recorded.

![Figure 1 — Backend terminal after registration: no audit entry](../../Assets/Nachiketh/a09/24%20terminal.png)

![Figure 2 — Bruno: registration request succeeded (201)](../../Assets/Nachiketh/a09/24.png)

**What this proves:** A successful account-creation event is invisible in logs. An attacker creating backdoor accounts would leave no structured evidence for incident response.

---

### Step 2 — SQL error details leaked to console

A malformed `POST /game` request triggered a database error. The full `ER_*` message with column names appeared in stdout via `console.log(err)`.

![Figure 3 — Backend terminal: raw SQL error exposed](../../Assets/Nachiketh/a09/25%20error.png)

![Figure 4 — Bruno: request that triggered the SQL error](../../Assets/Nachiketh/a09/25.png)

**What this proves:** Error handlers acted as an information-disclosure channel. Attackers probing input validation learn table and column names from log output.

---

### Step 3 — Username enumeration

Registering with an existing username returned a specific message revealing the account exists.

![Figure 5 — Bruno: username already exists (enumeration)](../../Assets/Nachiketh/a09/username%20dupe.png)

![Figure 6 — Bruno: alternate capture (request 20)](../../Assets/Nachiketh/a09/20.png)

---

### Step 4 — Email enumeration

Registering with an existing email returned a **different** message — confirming the email is registered even when the username was new.

![Figure 7 — Bruno: email already exists (enumeration)](../../Assets/Nachiketh/a09/email%20dupe.png)

![Figure 8 — Bruno: alternate capture (request 21)](../../Assets/Nachiketh/a09/21.png)

**Enumeration contrast:** The two distinct responses form a decision tree. An attacker cycles through candidate emails or usernames and maps which accounts exist in `users`.

---

### Step 5 — New-user contrast

Registering a brand-new username and email returned yet another response shape — proving attackers can distinguish "exists" from "new".

![Figure 9 — Bruno: new user contrast (request 22)](../../Assets/Nachiketh/a09/22.png)

---

### Step 6 — Review impersonation without audit trail

An authenticated customer (Terry) posted a review attributed to another user's ID in the URL path. The server accepted the request and wrote the review — with no audit entry recording the mismatch.

![Figure 10 — Bruno: review posted as another user (request 15)](../../Assets/Nachiketh/a09/15.png)

**Attack flow:**

```http
POST /users/3/game/12/review HTTP/1.1
Host: localhost:8081
Authorization: Bearer <Terry's token>
Content-Type: application/json

{"content":"Fake review from Terry posing as user 3","rating":1}
```

Terry's JWT contains `userid: 2` (or similar), but the path says `3`. Before the fix, the server stored `fk_users = 3` with no ownership check and no audit line.

---

### Step 7 — Auth required after A01 fixes

After A01 remediation, A09 re-testing required a valid admin Bearer token on protected routes. The Bruno collection documents the login → copy token → set Collection Auth workflow.

![Figure 11 — Bruno: login and Bearer token setup](../../Assets/Nachiketh/a09/bearer.png)

---

## 4. Database Storage

Logging gaps are application-layer — not stored in MySQL. However, the flaws interact with the database:

| Behaviour | Database impact |
|-----------|-----------------|
| Enumeration responses | Indirectly confirms rows exist in `users` |
| SQL errors in stdout | Reveals `users`, `game`, and related schema details |
| Review impersonation | `review` rows inserted with arbitrary `fk_users` from the URL |

Example of an impersonated review row (conceptual):

| reviewID | fk_users | fk_games | content | rating |
|----------|----------|----------|---------|--------|
| `25` | **`3`** (victim) | `12` | Fake review posted by Terry | `1` |

---

## 5. Code Analysis (Vulnerable Snippets)

### Raw error logging — `controller/app.js`

`console.log(err)` appeared in error handlers throughout the file (~22 instances), logging full database error objects to stdout.

![Figure 12 — Code: console.log(err) on GET /users error path (lines 226–228)](../../Assets/Nachiketh/a09/code/app%20226-228.png)

![Figure 13 — Code: console.log(err) on duplicate registration paths (lines 268, 278)](../../Assets/Nachiketh/a09/code/app%20268,278.png)

---

### Enumeration error messages — `controller/app.js`

Different client-facing messages revealed whether username, email, category, or platform already existed.

![Figure 14 — Code: username and email enumeration messages (lines 272, 282)](../../Assets/Nachiketh/a09/code/app%20272,%20282.png)

![Figure 15 — Code: category duplicate message (line 359)](../../Assets/Nachiketh/a09/code/app%20359.png)

![Figure 16 — Code: platform duplicate message (line 409)](../../Assets/Nachiketh/a09/code/app%20409.png)

**Before fix (representative):**

```javascript
if (err.code === "ER_DUP_ENTRY") {
    console.log(err);
    res.status(422);
    res.send('{"Message":"Username already exists!"}');  // or email-specific text
}
```

---

### Model-layer logging — `model/users.js`

Error paths and a commented token log line in the login flow.

![Figure 17 — Code: error logging and commented token log (lines 131, 143, 154)](../../Assets/Nachiketh/a09/code/user%20131%20143%20153,154.png)

---

### Token logging — `auth/verifyToken.js` (remediated under A01)

Original code actively logged headers and tokens. A commented `//console.log(token)` remained from the assignment template.

![Figure 18 — Code: commented token log in verifyToken.js (line 17)](../../Assets/Nachiketh/a09/code/verifyTocken%2017.png)

Active header/token logging was removed during A01 hardening. The commented line is a reminder that debug logging near auth code is high risk.

---

## 6. Remediation Strategy & Recommendations

A multi-layered approach addresses detection, disclosure, and authorisation gaps.

### Fix 1 — Structured audit logging and safe errors (`securityLog.js`)

```javascript
function audit(action, detail) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'audit',
        action: action,
        detail: detail || {}
    }));
}

function safeError(err) {
    var message = (err && err.message) ? err.message : String(err);
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: message
    }));
}
```

Every `console.log(err)` in controllers and models was replaced with `safeError(err)`. Security events call `audit()`:

| Event | Audit action |
|-------|--------------|
| User registered | `user_registered` |
| Login success / failure | `login_success` / `login_failed` |
| Game deleted | `game_deleted` |
| Review created | `review_created` |
| Review denied (impersonation) | `review_denied` |

### Fix 2 — Generic duplicate message (prevents enumeration)

```javascript
var DUPLICATE_MSG = '{"Message":"The requested resource already exists."}';

if (err.code === "ER_DUP_ENTRY") {
    safeError(err);
    res.status(422);
    res.send(DUPLICATE_MSG);
}
```

Username, email, category, and platform duplicates now return the same `422` body.

### Fix 3 — Review ownership check

```javascript
app.post('/users/:uid/game/:gid/review', verifyToken, function (req, res) {
    var userid = req.params.uid;

    if (String(req.userid) !== String(userid)) {
        audit('review_denied', { actor: req.userid, target: userid, gameID: gameID });
        res.status(403);
        return res.json({ auth: false, message: 'Not authorized!' });
    }
    /* ... insert review ... */
});
```

The JWT `userid` claim must match the `:uid` path parameter.

### Fix 4 — Production logging hygiene

- Ship logs to persistent storage (rotating files, ELK, CloudWatch) — stdout alone is lost on restart.
- Never log tokens, passwords, or full request headers.
- Alert on patterns: repeated `login_failed`, bursts of `review_denied`, spikes in `422` duplicates.

---

## 7. Verification & Security Testing

### Testing Methodologies

- **Code review:** Traced every `console.log` in `app.js`, model files, and `verifyToken.js`.
- **Manual API testing:** Bruno requests 15, 20–25 with and without Bearer tokens; terminal capture for log output.
- **Git history:** Confirmed `verifyToken` sensitive logging removal in the A01 commit.

### Remediation Results

| Test | Before fix | After fix |
|------|------------|-----------|
| Register user | Silent terminal | JSON audit: `"action":"user_registered"` |
| Login | No structured log | `"action":"login_success"` / `"login_failed"` |
| Duplicate register (username) | `"Username already exists!"` | Generic `422` — same message for email too |
| Duplicate register (email) | `"Email already exists!"` | Same generic `422` |
| SQL error | Full SQL stack in console | JSON `{"level":"error","message":"..."}` only |
| Terry → review as user 3 | `201 Created` | **403** + `review_denied` audit |
| `verifyToken` stdout | Headers/tokens logged (pre-A01) | No sensitive output |

Post-fix screenshots: save to `Assets/Nachiketh/a09-after/` per [postfix-screenshots guide](../guides/postfix-screenshots.md).

### Tools Used

| Tool | Purpose |
|------|---------|
| Bruno API Client | Trigger registration, enumeration, impersonation |
| Backend terminal (stdout) | Observe logging before/after |
| VS Code | Locate logging and enumeration code |
| Git history | Confirm verifyToken fix in A01 commit |

---

## Conclusion

| Issue | Severity | Status |
|-------|----------|--------|
| No audit logging | High | Fixed |
| `console.log(err)` leakage | High | Fixed |
| Username/email enumeration | Medium–High | Fixed |
| Review impersonation (unlogged) | High | Fixed |
| Token/header logging | High | Fixed under A01 |

**Root cause:** Logging was treated as developer debug output, not a security control. Error messages prioritised convenience over consistency.

**Workflow applied:** Remediate **A01** first (access control, SQLi, secrets, sensitive auth logging) → assess and fix **A09** (audit trails, safe errors, enumeration, review ownership).

**Remaining work:** persistent log storage; centralised monitoring and alerting; rate limiting on registration and login endpoints.

**Related report:** [nachiketh-report-a01.md](nachiketh-report-a01.md) — broken access control findings remediated before A09 testing.

---

## Appendix — Evidence Index

All paths relative to repository root.

| File | Description |
|------|-------------|
| `Assets/Nachiketh/a09/24 terminal.png` | No audit log after registration |
| `Assets/Nachiketh/a09/24.png` | Bruno registration success |
| `Assets/Nachiketh/a09/25 error.png` | SQL error in terminal |
| `Assets/Nachiketh/a09/25.png` | Bruno SQL trigger request |
| `Assets/Nachiketh/a09/username dupe.png` | Username enumeration response |
| `Assets/Nachiketh/a09/email dupe.png` | Email enumeration response |
| `Assets/Nachiketh/a09/20.png` | Username enum (Bruno 20) |
| `Assets/Nachiketh/a09/21.png` | Email enum (Bruno 21) |
| `Assets/Nachiketh/a09/22.png` | New-user contrast |
| `Assets/Nachiketh/a09/15.png` | Review impersonation |
| `Assets/Nachiketh/a09/bearer.png` | Login + Bearer token |
| `Assets/Nachiketh/a09/code/app 226-228.png` | `console.log(err)` pattern |
| `Assets/Nachiketh/a09/code/app 268,278.png` | `console.log(err)` on duplicates |
| `Assets/Nachiketh/a09/code/app 272, 282.png` | Enumeration messages |
| `Assets/Nachiketh/a09/code/app 359.png` | Category enum message |
| `Assets/Nachiketh/a09/code/app 409.png` | Platform enum message |
| `Assets/Nachiketh/a09/code/user 131 143 153,154.png` | `users.js` logging |
| `Assets/Nachiketh/a09/code/verifyTocken 17.png` | Commented token log |

---

*End of A09 report*
