---
author: Nachiketh
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report — OWASP A01 & A09

## A01 — Broken Access Control

Broken Access Control is the most prevalent category in the OWASP Top 10 2021. It occurs when an application does not properly enforce restrictions on what authenticated (or unauthenticated) users are allowed to do. In this codebase, the vast majority of API endpoints lack any authentication or authorisation checks whatsoever, allowing any user — or even completely unauthenticated visitors — to perform privileged operations.

---

### Detailed Finding 1: Missing Authentication on Administrative Endpoints

**Type of Flaw:** Missing Authentication & Authorisation — no `verifyToken` middleware on any data-modifying endpoint, and no role-based access control (RBAC) check anywhere in the application.

**Affected Code:**

The backend controller (`controller/app.js`) defines numerous endpoints that handle sensitive operations. Nearly all of them are registered **without** the `verifyToken` middleware. The only endpoint that uses it is `/CheckRole` (line 57), and even that endpoint merely returns the role without enforcing any restriction.

*`controller/app.js` lines 247–302 — POST /users (creating users with arbitrary type, including "admin"):*

```javascript
app.post('/users', function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var type = req.body.type;          // <-- client can set ANY type, e.g. "admin"
    var profile_pic_url = req.body.profile_pic_url;

    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) {
        // ...
        res.status(201);
        res.type("json");
        res.send(`{"userid":"${results.insertId}"}`);
    });
});
```

*`controller/app.js` line 529 – DELETE /game/:id (no auth):*

```javascript
app.delete('/game/:id', function (req, res) {
    var gameID = req.params.id;
    gameDB.deleteGame(gameID, function (err, results) {
        // ...
        res.status(204);
        res.type("json");
        res.send();
    });
});
```

*`controller/app.js` lines 435–495 — POST /game (no auth):*

```javascript
app.post('/game', upload.single('game_image'), function (req, res) {
    var title = req.body.title;
    // ...
    gameDB.insertGame(title, game_description, year, game_image, function (err, results) {
        // ...
    });
});
```

*`controller/app.js` lines 337–381 — POST /category (no auth):*

```javascript
app.post('/category', function (req, res) {
    var catname = req.body.catname;
    // ...
    categoryDB.insertCategory(catname, cat_description, function (err, results) {
        // ...
    });
});
```

For comparison, the only protected endpoint (`/CheckRole`) at line 57:

```javascript
app.get('/CheckRole', verifyToken, function (req, res) {
    const userRole = req.type;
    res.status(200);
    res.type("json");
    res.send({ role: userRole });
});
```

Even this endpoint does **not** enforce that the role is `"admin"` — it simply echoes whatever role is in the token. There is no middleware that checks `req.type === 'Admin'` on any endpoint.

**Exploitation:**

*Step 1 — Discover unprotected endpoints via API exploration*

Using Bruno API Client, I enumerated the available endpoints. The collection (visible in `API-Testing/opencollection.yml`) revealed multiple endpoints with no authentication requirement.

![API Testing Overview](../Assets/Nachiketh/01%20-APITesting.png)

*Step 2 — Create an admin account without authentication*

Since `POST /users` accepts a `type` field from the client with no validation, I sent a request to `POST http://localhost:8081/users` with the JSON body:

```json
{
  "username": "hacker_admin",
  "email": "hacker@example.com",
  "password": "pwned123",
  "type": "admin"
}
```

The server responded with `201 Created` and a new user ID, confirming the admin account was created without any authentication or authorisation.

![Creating Admin Account via Bruno](../Assets/Nachiketh/11-Brunocancreate%20an%20account%20ad%20admon.png)

*Step 3 — Delete a game without authentication*

A simple `DELETE` request to `http://localhost:8081/game/14` with no Authorization header succeeded, returning `204 No Content`. This removed a game from the database with zero access control.

![Unauthorized DELETE game](../Assets/Nachiketh/12-Anyonecandeletegames.png)

*Step 4 — Add a game, category, or platform without authentication*

Similarly, `POST /game`, `POST /category`, and `POST /platform` all accepted requests without any token, allowing an attacker to inject arbitrary data into the system.

*Step 5 — Bypass client-side admin check in the frontend*

The admin dashboard (`admin.html`) implements its access control entirely on the client side:

```javascript
async function checkAdmin(){
    const token = localStorage.getItem('Token');
    if(!token){ lock(); return; }
    try{
        const res = await fetch(apiBase + '/CheckRole', { headers: { 'Authorization': 'Bearer ' + token } });
        if(!res.ok){ lock(); return; }
        const d = await res.json();
        if(d.role !== 'Admin' && d.role !== 'admin'){ lock(); }
    }catch(e){ console.error(e); lock(); }
}
function lock(){
    document.getElementById('adminContent').classList.add('locked');
    document.getElementById('lockedMessage').classList.remove('d-none');
}
```

The `lock()` function merely adds a CSS class `locked` (which sets `opacity: .6`) — it does not remove the content from the DOM, nor does it block navigation to admin pages. An attacker can trivially bypass this by:

1. Opening browser Developer Tools
2. Removing the `locked` class from the element
3. Accessing all admin functionality directly

![Browser Dev Tools Bypassing Admin Lock](../Assets/Nachiketh/10%20-%20Insecure%20Browser%20tools.png)

**Impact:**

- **Privilege Escalation:** Any user can create an admin account by setting `type: "admin"`.
- **Data Integrity Loss:** Any attacker can add, modify, or delete games, categories, and platforms.
- **Complete System Compromise:** An attacker with admin-level access can manipulate the entire game catalog and user database.
- **Client-Side Bypass:** The frontend "protection" is purely cosmetic and provides no real security.

**Recommendation:**

To fix this, the `verifyToken` middleware needs to be applied to all endpoints that modify or access protected data, not just `/CheckRole`. A new `requireAdmin` middleware should be created that, after verifying the JWT, checks that `req.type === 'admin'` before allowing the operation to proceed. The `POST /users` endpoint must never trust the client to supply the `type` field — role assignment should default to a standard user role and only be changeable by an already-authenticated admin. Additionally, access control must be enforced server-side; relying on client-side CSS or JavaScript hiding (as done in `admin.html`) provides no real security and can be bypassed by anyone who opens browser developer tools.

---

### Brief Finding 1: GET /users Exposes All User Data (Including Passwords)

**Type of Flaw:** Insecure Direct Object Reference (IDOR) / Mass Assignment — the `GET /users` endpoint returns all user records with plaintext passwords to anyone, with no authentication required.

**Affected Code:**

*`controller/app.js` lines 219–241:*

```javascript
app.get('/users', function (req, res) {
    userDB.getUser(function (err, results) {
        if (err) {
            res.status(500);
            res.type("json");
            res.send(`{"Message":"Internal Server Error"}`);
        } else {
            res.status(200);
            res.type("json");
            res.send(results);   // <-- sends ALL fields including password
        }
    });
});
```

*`model/users.js` lines 16–47 — the SQL query selects the `password` column:*

```javascript
var getUserSql = `select userid, username, email, password, type, profile_pic_url,
                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users`;
```

Note that passwords are stored and transmitted in **plaintext** (no hashing).

![GET /users exposing all users](../Assets/Nachiketh/02%20-%20ExposedUsersOnPort8001.png)

![Passwords visible in plaintext](../Assets/Nachiketh/03%20-%20PasswordsUnhashed.png)

**Impact:** Full account takeover of every registered user. An attacker can use any exposed email/password combination to log in and obtain a valid JWT, then impersonate that user for all subsequent operations. This was verified by taking Alex's credentials from the exposed list and logging in successfully.

![Login as Alex using exposed credentials](../Assets/Nachiketh/04%20-%20LogInasAlex.png)

![Password confirmed](../Assets/Nachiketh/05%20-%20ExposedPassword.png)

**Recommendation:**

The `GET /users` endpoint must require authentication via the `verifyToken` middleware, and should additionally check that the requester has admin privileges before returning the full user list. The `password` column should be removed from the SQL SELECT query or stripped server-side before the response is sent. More fundamentally, passwords must be hashed using a strong algorithm like bcrypt or Argon2 before storage — this would prevent credential exposure even if the data is accidentally leaked.

---

## A09 — Security Logging & Monitoring Failures

Security Logging & Monitoring Failures (previously called "Insufficient Logging & Monitoring") occur when the application fails to generate, preserve, or monitor audit records for security-relevant events. This makes it impossible to detect, investigate, or respond to attacks in progress or reconstruct incidents after the fact.

---

### Detailed Finding 2: No Audit Logs on Sensitive Operations

**Type of Flaw:** Complete absence of security-relevant audit logging — the application logs only generic console output (`console.log(err)`) for error conditions but never records who performed what action, when, or from which IP address.

**Affected Code:**

The application uses `console.log()` throughout, but only for debugging purposes (printing request headers, tokens, or errors). There is **no structured audit logging** for security events.

*`controller/app.js` — Error logging pattern (e.g., line 77, 105, 174, 227, etc.):*

```javascript
if (err) {
    console.log(err);   // only logs the error object, no context about who, what, when
    res.status(500);
    res.type("json");
    res.send(`{"Message":"some error encounted!"}`);
}
```

*`controller/app.js` line 134 — Login response logs user data (including password exposure risk):*

```javascript
console.log(result);   // logs entire result object including password field
```

*`controller/app.js` line 158 — Logout:*

```javascript
app.post('/users/logout', function (req, res) {
    console.log("..logging out.");  // no user identity logged
    // ...
});
```

*`controller/app.js` lines 557–582 — POST review with no logging of the actor:*

```javascript
app.post('/users/:uid/game/:gid/review', function (req, res) {
    var userid = req.params.uid;
    var gameID = req.params.gid;
    // ...
    reviewDB.insertReview(userid, gameID, content, rating, function (err, results) {
        // ...
    });
});
```

There is no IP address logging, no timestamped audit trail, no logging of who performed destructive actions (DELETE, POST), and no monitoring of failed authentication attempts.

**Exploitation:**

*Step 1 — Perform destructive actions with no audit trail*

When an attacker deletes a game via `DELETE /game/14`, the server simply returns `204 No Content`. The only server-side output is the request headers printed by the `verifyToken` middleware (but since no middleware is applied, even that doesn't happen). There is no record of which user performed the delete, what time it occurred, what resource was deleted, or the source IP address.

The server console shows no meaningful audit data:

![Server console output lacks audit information](../Assets/Nachiketh/08-Consolecoammnd.png)

*Step 2 — Create an admin account without triggering any alert*

The `POST /users` endpoint succeeds silently. No log entry is created to indicate that a user with `type: "admin"` was registered. A security team would have no way of knowing that privilege escalation occurred.

*Step 3 — Impersonate other users with no forensic evidence*

The `POST /users/:uid/game/:gid/review` endpoint accepts any user ID in the URL path — there is no verification that the requesting user matches the `:uid` parameter. An attacker can post a review as any user without leaving an audit trail.

![Impersonation via POST review](../Assets/Nachiketh/13-Exposure.png)

The Bruno collection includes `15-Impersonate-Review-POST.yml` which demonstrates this:

```yaml
name: 15 - Impersonate Review - POST /users/1/game/12/review (VULNERABILITY)
http:
  method: POST
  url: http://localhost:8081/users/1/game/12/review
  body:
    type: json
    data: |-
      {
        "content": "This review was posted by someone else!",
        "rating": 5
      }
```

*Step 4 — Brute-force login attempts go undetected*

The login endpoint (`POST /users/login`) logs only generic error messages on authentication failure, but does not track the number of failed attempts per email address, the source IP, or the timestamp. An attacker can brute-force passwords indefinitely without triggering any account lockout or alert.

**Impact:**

- **No Incident Detection:** Intrusions and attacks cannot be detected in real-time because there are no security events to monitor.
- **No Forensic Evidence:** After a breach, there is no audit trail to determine the scope, method, or perpetrator of the attack.
- **Compliance Violation:** Regulatory frameworks (PCI-DSS, GDPR, SOX) require detailed audit logging of access to sensitive data.
- **Impossible to Reconstruct Attacks:** Without timestamps, user identities, and action descriptions, reconstructing an attack timeline is impossible.

**Recommendation:**

A structured logging library such as Winston, Morgan, or Pino should be introduced to log security events with consistent fields: timestamp, user ID, source IP, HTTP method, URL path, and response status. At minimum, the following events must be logged: successful and failed login attempts, account creation (especially admin accounts), all DELETE/POST/PUT operations on sensitive resources, access-denied (403) responses, and token verification failures. These logs should be persisted to rotating files or a central monitoring service (e.g., AWS CloudWatch, ELK Stack). An account lockout mechanism should also be implemented after N consecutive failed login attempts, with each attempt logged. Crucially, sensitive data such as passwords and full token values must never be written to logs.

---

### Brief Finding 2: Verbose Error Messages Leak Information

**Type of Flaw:** Verbose error handling that exposes internal implementation details — error messages returned to the client and logged to the console include database error objects, SQL syntax details, and stack traces.

**Affected Code:**

Throughout `controller/app.js`, error responses return generic messages, but the server logs full error objects via `console.log(err)`, which in production should never be visible.

*`model/users.js` lines 100–101 — SQL injection point also acts as an information leak:*

```javascript
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;
```

When a malformed or SQL-injected value is passed, the database error (including the full SQL query) is returned to the client via the generic error handler, or logged to the console.

*`model/game.js` lines 159 — SQL injection via template literals:*

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

A failed SQL injection attempt reveals the SQL syntax error in the server console output.

*`controller/app.js` — Generic error handler pattern:*

```javascript
if (err) {
    console.log(err);  // logs full SQL error with query structure
    res.status(500);
    res.type("json");
    res.send(`{"Message":"some error encounted!"}`);
}
```

While the client-facing error message is generic (`"some error encounted!"`), the full error details are logged to `console.log(err)`. If the application is deployed with console output accessible (e.g., CloudWatch, Heroku logs, Docker logs), an attacker who triggers errors can gain visibility into the database schema, table names, column names, and query structure.

![SQL Injection error revealing structure](../Assets/Nachiketh/14-SQL%20Injection.png)

**Impact:** Information leakage can aid attackers in crafting more sophisticated attacks. Knowledge of table names, column names, and query structure makes SQL injection, IDOR, and other attacks significantly easier.

**Recommendation:**

In production, full error objects should never be logged to console. Instead, a global error handler should return standardised, generic error responses to clients while logging detailed information securely to file with configurable log levels. Error messages must be sanitised to remove SQL query details, file paths, and stack traces before any output. Additionally, parameterised queries should be used throughout (as in most other model functions) to replace the template-literal string interpolation seen in `getUserByUserid` and `insertGame`, which would eliminate both the SQL injection vulnerability and the accompanying information leakage.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| **Bruno API Client** | Manual and automated API request crafting; testing endpoints without authentication, SQL injection payloads, and JWT tampering. Collection saved in `API-Testing/`. |
| **Browser Developer Tools** | Inspecting network traffic, modifying DOM elements to bypass client-side access controls, viewing `localStorage` tokens. |
| **curl** | Quick command-line verification of endpoint accessibility and response inspection. |
| **VS Code** | Source code review — tracing endpoint routes, middleware application, and database query construction. |

## Conclusion

The analysis of this web application reveals **critical failures in access control (A01)** and **security logging & monitoring (A09)** — two of the most impactful categories in the OWASP Top 10 2021.

For **A01 — Broken Access Control**, the application fundamentally lacks server-side authorisation. The `verifyToken` middleware is applied to only a single endpoint (`/CheckRole`), and even that endpoint performs no role-based enforcement. Data-modifying operations (`POST /game`, `DELETE /game/:id`, `POST /category`, `POST /platform`, `POST /users`) are completely unprotected, allowing any unauthenticated attacker to create admin accounts, delete games, and manipulate the entire catalogue. The frontend admin check is purely cosmetic, implemented as a CSS class toggle that any user can bypass with browser developer tools. User data, including plaintext passwords, is exposed en masse via `GET /users`.

For **A09 — Security Logging & Monitoring Failures**, the application generates no meaningful audit trail. Security-relevant events — account creation, privilege escalation, data deletion, failed login attempts — pass silently with no record of who performed the action, when, or from where. This makes incident detection impossible and forensics after a breach infeasible. Verbose error logging leaks database schema details and SQL query structures to console output, aiding attackers in crafting more precise exploits.

Both categories share a common root cause: **treating security as a client-side concern** and **failing to enforce controls at the server boundary**. The recommended fixes — applying authentication and RBAC middleware to all endpoints, removing plaintext password storage, implementing structured audit logging, and sanitising error output — would collectively raise the application's security posture from critically vulnerable to reasonably defended against these attack vectors.
