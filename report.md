# ST2515 — Secure Coding Project

## Secure Vulnerability Analysis Report

**Team Members:**
- Nachiketh — A01 Broken Access Control + A09 Logging & Monitoring
- Mike — A03 Injection
- Keefe — A07 Identification & Authentication Failures
- Sitt — A04 Insecure Design

**Submission Date:** 29 June 2026

---

## Category Selection Rationale

### Why A01 — Broken Access Control over A02 — Cryptographic Failures

Both A01 and A02 are present in the codebase, but A01 was chosen for detailed analysis because:

| Factor | A01 — Broken Access Control | A02 — Cryptographic Failures |
|--------|----------------------------|------------------------------|
| **Exploitability** | Trivially exploitable with single `curl` commands — no auth needed | Requires intercepting traffic or extracting tokens; less visual impact |
| **Demo strength** | Add/delete games live, dump all user passwords in browser | Password comparison, JWT decode are harder to demonstrate visually |
| **Code surface** | 4+ unprotected endpoints, clear middleware omission | Overlaps heavily with A07 (plain-text passwords, weak JWT secret) |
| **OWASP ranking** | #1 on OWASP Top 10 2021 | #2 on OWASP Top 10 2021 |
| **Independent findings** | A01 stands alone as its own category | Most A02 issues in this app are also A07 issues |

The app has trivially exploitable A01 flaws:
- `POST /game`, `DELETE /game/:id` — zero auth required, anyone can add/delete games
- `GET /users` — returns every user record including plain-text passwords with no authentication

A02 is weaker here because the crypto failures (plain-text passwords, weak JWT secret) overlap heavily with A07 and are harder to demonstrate visually.

---

## A01 — Broken Access Control (Detailed)

### Finding 1: Missing Authentication on Admin Endpoints

**Type of flaw:** Broken Access Control — Missing authorization checks on server-side endpoints that perform privileged operations.

**Location:**
- `Assignment/BackEndServer/controller/app.js` lines 337, 387, 435, 529

**Vulnerable code snippet:**

```javascript
// Line 337 — No verifyToken middleware
app.post('/category', function (req, res) { ... });

// Line 387 — No verifyToken middleware
app.post('/platform', function (req, res) { ... });

// Line 435 — No verifyToken middleware
app.post('/game', upload.single('game_image'), function (req, res) { ... });

// Line 529 — No verifyToken middleware
app.delete('/game/:id', function (req, res) { ... });
```

**How it can be exploited:**
An unauthenticated attacker can send direct HTTP requests to these endpoints without any token or session. For example, deleting any game:

```bash
curl -X DELETE http://localhost:8081/game/1
```

Or adding a new game without being logged in:

```bash
curl -X POST http://localhost:8081/game \
  -F "title=Malicious Game" \
  -F "game_description=Hacked" \
  -F "year=2026" \
  -F "game_image=@exploit.jpg"
```

Only a single endpoint in the entire API (`/CheckRole` at line 57) uses the `verifyToken` middleware. All other endpoints are publicly accessible.

**Tools used:** curl, Postman, browser developer tools

**Recommendation:**
Apply the `verifyToken` middleware to all admin endpoints. Only authenticated users with the `Admin` role should be allowed to create, update, or delete resources.

**Fixed code:**

```javascript
// Add verifyToken + role check middleware
function requireAdmin(req, res, next) {
    if (req.type !== 'Admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Protected endpoints
app.post('/category', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/platform', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function (req, res) { ... });
app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) { ... });
```

**Best Secure Coding Practice:**
Apply the principle of least privilege. Every endpoint should authenticate the requester before processing. Use middleware consistently rather than duplicating auth checks inside route handlers. Default-deny pattern — all endpoints are locked unless explicitly marked public.

---

## A01 — Broken Access Control (Brief)

### Finding 2: GET /users Exposes All User Records

**Type of flaw:** Broken Access Control — Sensitive data exposure via an unauthenticated endpoint.

**Location:** `Assignment/BackEndServer/controller/app.js` line 219
**Model:** `Assignment/BackEndServer/model/users.js` lines 16–47

**Vulnerable code snippet:**

```javascript
// app.js line 219
app.get('/users', function (req, res) {
    userDB.getUser(function (err, results) { ... });
});
```

```javascript
// users.js lines 28-29 — password column included in query
var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

**Impact:** Any unauthenticated visitor can retrieve all registered users' data, including their plain-text passwords, by visiting `http://localhost:8081/users`. This violates confidentiality of user credentials.

**Fixed code:**

```javascript
// Remove password from SELECT query
var getUserSql = `select userid, username, email, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

Additionally, protect the endpoint with `verifyToken` and restrict to admin users only.

**Best Secure Coding Practice:** Never expose internal user IDs or credentials in API responses. Apply the principle of data minimization — only return fields the client legitimately needs.

--- 
## A03 — Broken Access Control (Detailed)
(Content to be filled by Mike)


--- 
## A03 — Broken Access Control (Brief)
(Content to be filled by Mike)


--- 
## A07 — Identification & Authentication Failures (Detailed)
### Finding 1: Plain-text Password Storage and Lack of Hashing ###

--- 





