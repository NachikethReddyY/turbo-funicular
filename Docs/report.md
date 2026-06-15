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
## A03 — Injection (Detailed)

### Finding 1: SQL Injection in `GET /users/:userid`

**Type of flaw:** SQL Injection caused by unsafe string interpolation in the database query.

**Location:**
- `Assignment/BackEndServer/controller/app.js:308-320`
- `Assignment/BackEndServer/model/users.js:87-103`

**Vulnerable code snippet:**

```javascript
// controller/app.js
app.get('/users/:userid', function (req, res) {
    var userid = req.params.userid;

    userDB.getUserByUserid(userid, function (err, results) {
        ...
    });
});
```

```javascript
// model/users.js
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;
```

**Why this is vulnerable:**
The `userid` value from the URL is inserted directly into the SQL statement without parameterization or validation. Because the value is treated as part of the SQL text, an attacker can manipulate the query structure and attempt to retrieve data outside the intended record.

**How it can be exploited:**
This endpoint is public and does not require authentication. An attacker can supply crafted input such as `1 OR 1=1` or other SQL syntax in the `userid` path parameter to try to change the query behavior. If the database accepts the payload, the response may reveal unintended user records.

**Impact:**
- Unauthorized access to user data
- Exposure of usernames, emails, passwords, and profile information
- Possible account compromise if exposed credentials are reused
- Loss of confidentiality and trust in the application

**Recommendation:**
Use a parameterized query instead of string interpolation. The endpoint should also be protected by authentication and authorization checks so users can only access records they are allowed to see.

**Fixed code:**

```javascript
var getUserByUserIDSql = `
    SELECT userid, username, email, type, profile_pic_url,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    WHERE userid = ?;
`;

dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
    ...
});
```

**Best Secure Coding Practice:**
Always use prepared statements or parameterized queries for database access. Never concatenate user input into SQL strings. Combine this with access control checks so users can only access their own records unless they have explicit admin privileges.


--- 
## A03 — Injection (Brief)

### Finding 2: SQL Injection in `POST /game`

**Type of flaw:** SQL Injection caused by unsafe string interpolation in the game creation query.

**Location:**
- `Assignment/BackEndServer/controller/app.js:435-471`
- `Assignment/BackEndServer/model/game.js:153-160`

**Vulnerable code snippet:**

```javascript
// controller/app.js
app.post('/game', upload.single('game_image'), function (req, res) {
    var title = req.body.title;
    var game_description = req.body.description;
    var year = req.body.year;
    var game_image = req.file;

    gameDB.insertGame(title, game_description, year, game_image, function (err, results) {
        ...
    });
});
```

```javascript
// model/game.js
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

**Impact:** The `title`, `game_description`, and `year` fields are copied directly into the SQL statement. If an attacker submits crafted values, the database query can be altered or broken, which can corrupt game data or cause unexpected behavior.

**Fixed code:**

```javascript
var insertGameSql = `
    INSERT INTO game (title, game_description, year, game_image)
    VALUES (?, ?, ?, ?)
`;

dbConn.query(insertGameSql, [title, game_description, year, game_image.buffer], function (err, results) {
    ...
});
```

**Best Secure Coding Practice:** Use parameterized queries for every database write operation and validate incoming form fields before they reach the model layer.


--- 
## A04 — Insecure Design (Detailed)

### Finding 1: Frontend-Only Admin Access Control

**Type of flaw:** Insecure Design — Security controls exist only in the browser (UI hiding and JavaScript checks) while the API was never designed to enforce the same admin rules on the server.

**Location:**
- `Assignment/FrontEndServer/Public/addNewCategory.html` lines 68–82
- `Assignment/FrontEndServer/Public/admin.html` lines 87–96
- `Assignment/BackEndServer/controller/app.js` lines 57–64, 337, 387, 435, 529

**Vulnerable code snippet:**

```javascript
// addNewCategory.html — admin check runs only in the browser
async function checkAdmin(){
    const token = localStorage.getItem('Token');
    if(!token){ showAlert('Admin access required. Please login.', 'warning'); return false; }
    const res = await fetch(apiBase + '/CheckRole', { headers: { 'Authorization': 'Bearer ' + token } });
    const d = await res.json();
    return (d.role === 'Admin' || d.role === 'admin');
}
// Form submit is blocked if checkAdmin() fails — but the API has no matching rule
```

```javascript
// app.js — /CheckRole validates JWT and returns role, but nothing else uses it
app.get('/CheckRole', verifyToken, function (req, res) {
    const userRole = req.type;
    res.send({ role: userRole });
});

// Admin routes — NO verifyToken, NO requireAdmin middleware
app.post('/category',  function (req, res) { ... });
app.post('/platform', function (req, res) { ... });
app.post('/game', upload.single('game_image'), function (req, res) { ... });
app.delete('/game/:id', function (req, res) { ... });
```

**Why this is an insecure design (not just a missing line of code):**
The application was architected as if hiding admin tabs and calling `checkAdmin()` before form submit were sufficient protection. The backend was never given a matching authorization layer. Even if every frontend check worked perfectly, any HTTP client could still perform admin actions because the API design treats those routes as public write endpoints.

**How it can be exploited:**
An attacker does not need to open the admin UI at all. They can bypass all frontend controls with direct API calls:

```bash
# Create a category without logging in
curl -X POST http://localhost:8081/category \
  -H "Content-Type: application/json" \
  -d '{"catname":"BypassCategory","description":"Created without auth"}'

# Delete a game without a token
curl -X DELETE http://localhost:8081/game/1
```

A normal user who is blocked by `checkAdmin()` in the browser can still run the same requests from Postman or curl. The UI gives a false sense of security while the server accepts the operation.

**Tools used:** Manual code review, curl, Postman, browser developer tools

**Recommendation:**
Design security on the server first. Define a role model (`Customer`, `Admin`) and a middleware chain that every privileged route must pass through: `verifyToken` → `requireAdmin` → `validateInput` → controller. Frontend checks may remain for user experience, but must be treated as non-security (defense in depth only).

**Fixed code:**

```javascript
// auth/requireAdmin.js — server-side role enforcement (new middleware)
function requireAdmin(req, res, next) {
    if (req.type !== 'Admin' && req.type !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// app.js — admin routes protected by design, not by UI
app.post('/category', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/platform', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function (req, res) { ... });
app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) { ... });
```

**Best Secure Coding Practice:**
Apply threat modelling during design — ask “what if the user never uses our frontend?” Never trust the client for authorization decisions. Use a default-deny API design where every state-changing route declares its required authentication and role at the routing layer, not inside HTML or JavaScript.

---

## A04 — Insecure Design (Brief)

### Finding 2: Client-Controlled User Role on Registration

**Type of flaw:** Insecure Design — Role assignment is delegated to the client instead of being decided server-side, allowing privilege escalation by design.

**Location:**
- `Assignment/BackEndServer/controller/app.js` lines 247–257
- `Assignment/FrontEndServer/Public/register.html` lines 70–73, 132
- `Assignment/BackEndServer/model/users.js` lines 52–66

**Vulnerable code snippet:**

```javascript
// register.html — UI only offers "user", but this is not enforced anywhere else
<select id="type" name="type" class="form-select" required>
  <option value="user" selected>User</option>
</select>
```

```javascript
// app.js — server trusts client-supplied role
app.post('/users', function (req, res) {
    var type = req.body.type;
    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) { ... });
});
```

**Impact:** Anyone can register as an administrator by sending `"type": "Admin"` in the JSON body, even though the registration form only shows a normal user option. There is also no canonical role enum — the UI uses `"user"`, the database seed uses `"Customer"`, and admin checks look for `"Admin"`. This broken role model is a design flaw that makes authorization inconsistent across the entire application.

**Fixed code:**

```javascript
// app.js — server assigns role; ignore client input
app.post('/users', function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var profile_pic_url = req.body.profile_pic_url;
    var type = 'Customer';  // always set by server

    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) { ... });
});
```

Additionally, remove `type` from the registration request body in `register.html` so the client cannot suggest a role at all.

**Best Secure Coding Practice:**
Treat role and permission assignment as a server-side business rule. Whitelist allowed values in one place (constants or database enum). Never expose privileged fields in public registration APIs. Admin accounts should be created only through seed data, manual promotion, or a separate protected admin workflow.


--- 
## A07 — Identification & Authentication Failures (Detailed)
### Finding 1: Plain-text Password Storage and Lack of Hashing ###

Type of flaw: Identification & Authentication Failures — Insecure credential storage allowing unauthorized access upon database compromise.

- Location: - Assignment/BackEndServer/model/users.js (Inside registration and login query handlers)

<img width="536" height="233" alt="image" src="https://github.com/user-attachments/assets/637df0b0-6a13-4145-997b-93c8f948b0f2" />

The password is being saved into the database by the SQL workbench, we can see that the password is not properly hashed and displayed in plain text

<img width="455" height="230" alt="image" src="https://github.com/user-attachments/assets/8fee31e8-c8a8-4672-95df-90917641f237" />

## How It Can Be Exploited Specifically
An attacker can specifically exploit this plain-text credential storage vulnerability through direct identification and authentication failures within the application lifecycle:

1. A07 Credential Harvesting: An attacker targets the authentication infrastructure directly. If the application logs account information insecurely, exposes unencrypted database backup files, or fails to implement rate-limiting on login forms, an attacker can harvest user credentials.

2. Cleartext Acquisition: Because the application stores user passwords in human-readable plain text without wrapping them in an adaptive cryptographic hashing function (like bcrypt), the attacker reads the raw credentials immediately upon gaining access to the data layer. The attacker does not need to spend time running brute-force hardware arrays to crack hashes.

3. Authentication UI Replay: The attacker maps these cleartext identity strings directly to the public-facing application frontend.

Below is the step-by-step demonstration of how a harvested account credential is replayed to exploit the system:

- Step 1: Gain Access to Stored Credentials
The attacker targets the application's underlying infrastructure or active transit paths to locate a vulnerable data source. This typically involves identifying secondary flaws like an unparameterized database query (SQL Injection), discovering unencrypted database backup files (.sql or .bak) left exposed in public web roots, or locating verbose backend logs.

- Step 2: Extract Plain-Text Credentials
Upon locating the storage medium, the attacker reads the raw credentials immediately. Because the application fails to process passwords through an adaptive, one-way cryptographic hash function (such as bcrypt), the attacker completely bypasses the computationally expensive "cracking" or brute-forcing phase.

### Registration Ingestion Baseline
<img width="959" height="469" alt="image" src="https://github.com/user-attachments/assets/1a965573-3916-48bc-80db-a430d298f451" />

The front-end account creation interface sends raw, unhashed payloads to the backend /users endpoint upon registration. The server registers the account successfully and returns an identifier, but fails to encrypt or hash the incoming password string before persistence.

- Step 3: Identify Valid Accounts
The attacker parses the exposed dataset to select valid, active credential pairs. Simultaneously, because the frontend application replicates this plain-text data into the client's browser profile, the attacker can use a client-side vector like Cross-Site Scripting (XSS) to automatically harvest active credentials from other users' browser sessions.

### Client-Side Evidence (Browser Local Storage):
<img width="959" height="446" alt="image" src="https://github.com/user-attachments/assets/1c32503e-d787-42c4-ab4d-17f1e1193c35" />

Frontend session management state showing that the user's raw password (1) is explicitly written to persistent browser localStorage under the key logPassword

## Identify code snippet exposing the vulnerability

The authentication weakness spans both the frontend client-side session management and backend API responses. The following code snippets demonstrate the insecure handling of credentials and authentication data.

---

### 1. Frontend Client-Side: Insecure Credential Storage (localStorage)

The application stores sensitive authentication data in browser localStorage when the "Remember Me" feature is enabled.

```javascript
localStorage.setItem('logEmail', email);
localStorage.setItem('logPassword', pwd);
```

#### Security Issue:
- Password is stored in plain text in the browser
- Accessible via JavaScript
- Can be stolen via XSS attacks
- Not secure for persistent authentication storage

### 2. Registration sends raw password to backend

The frontend sends the password directly to the backend /users endpoint without encryption.

<img width="551" height="301" alt="image" src="https://github.com/user-attachments/assets/0922ec36-a6c4-41d6-8807-787a23c84c7e" />

``` javascript
async function registerUser() {

    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const type = document.getElementById('type').value;
    const profile_pic_url = document.getElementById('profile_pic_url').value;

    const res = await fetch('http://localhost:8081/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username,
            email,
            password,
            type,
            profile_pic_url
        })
    });
}
```

#### Security Issue:
- Password is transmitted in raw form
- No client-side encryption or hashing
- Relies fully on backend security (which was initially missing hashing)

### 3. Login API response exposes sensitive authentication data

## Impact

Passwords are stored in plain text within the database instead of being hashed before storage. If an attacker gains access to the database through a data breach, misconfiguration, or another vulnerability, all user passwords would be immediately exposed.

### Potential Consequences

- Unauthorized access to user accounts.
- Credential stuffing attacks against other services where users reuse the same password.
- Exposure of sensitive user information and application data.
- Potential privilege escalation if administrator credentials are compromised.
- Non-compliance with security best practices outlined in OWASP A07:2021 – Identification and Authentication Failures.

### Tools and Methods Used to Test the Web System

The following tools were used to identify and verify security vulnerabilities within the application.

---

####  MySQL Workbench

**Purpose:**  
Used to inspect and validate database-level storage of user credentials.

**Testing Activities:**
- Queried the `users` table to examine how passwords were stored.
- Verified whether passwords were stored in plain text or hashed format.
- Checked newly inserted user records after registration.
- Compared database records before and after implementing password hashing.

**Evidence:**

The screenshot below shows how the password storage was tested by creating or modifying user records and inspecting the resulting values stored in the database. This was used to verify whether passwords were stored in plain text or securely hashed.

<img width="485" height="232" alt="MySQL Workbench Password Verification" src="https://github.com/user-attachments/assets/59c0f3cd-9e79-4ad1-a339-38a39dad8a75" />

---

#### Browser Developer Tools (Chrome DevTools)

**Purpose:**  
Used to inspect client-side storage and analyse authentication-related data exposure.

**Testing Activities:**
- Inspected **Application → Local Storage** to identify sensitive data stored in the browser.
- Verified whether user credentials, session information, or authentication tokens were stored insecurely.
- Monitored the **Network** tab during login and registration requests.
- Analysed API requests and responses for potential exposure of sensitive information.

**Evidence:**
<img width="959" height="461" alt="image" src="https://github.com/user-attachments/assets/60543c09-f509-4fc1-a745-a87bf77ffc0f" />

---

#### Postman

<img width="557" height="303" alt="image" src="https://github.com/user-attachments/assets/3478ab6d-6a8d-41a1-8106-acbc744f35da" />

**Purpose:**  
Used to test and verify backend authentication and user-related API endpoints independently of the frontend application.

**Testing Activities:**
- Sent HTTP requests directly to `/users/login` and `/users` endpoints
- Verified whether passwords are transmitted in plain text during login and registration
- Checked API responses for exposed sensitive data such as JWT tokens and user details
- Validated server-side handling of authentication requests without frontend interference
- Confirmed whether authentication controls rely on backend validation or client-side input


---

---

### Risk Assessment

**Risk Level:** High  

Storing passwords in plain text is a critical security vulnerability. If the database is compromised, attackers can directly access user credentials without needing to perform any cracking or decryption. This significantly increases the severity of the breach, potentially leading to unauthorized account access and data exploitation.

---

### Recommendation

To protect user passwords, they should never be stored in plain text. Instead, passwords should be secured using modern hashing algorithms such as **bcrypt** or **Argon2**.

These hashing algorithms convert passwords into irreversible hashed values (a fixed string of characters), ensuring that:

- The original password cannot be retrieved from the stored value  
- Even if the database is exposed, user credentials remain protected  
- Each password is uniquely hashed using a salt, making brute-force attacks much harder  

#### Example:

Instead of storing:
```bash
password123
```

The system should store a hashed value such as:
```bash

$2a$10$N9qo8uLOickgx2ZMRZoMye...

```

---

### Impact of Fix

Implementing password hashing significantly improves system security by:
- Preventing direct credential theft from database leaks  
- Reducing risk of account takeover  
- Aligning with industry security standards (OWASP best practices)  

--- 

### Example of Fix

To mitigate the risk of password exposure, the application should implement **bcrypt hashing** for password storage and authentication. Instead of storing passwords in plain text, passwords are hashed before being saved to the database, making them significantly more difficult for attackers to obtain and misuse.

The figure below shows an example of the changes made to incorporate bcrypt hashing into the application, where passwords are hashed before being stored in the database.

<img width="291" height="59" alt="image" src="https://github.com/user-attachments/assets/36f19f7b-4005-4d8f-9902-a006658c111e" />

**Fixed code:**
```bash
insertUser: function (username, email, password, type, profile_pic_url, callback) {

    var dbConn = db.getConnection();

    dbConn.connect(function (err) {

        if (err) {
            return callback(err, null);
        }

        bcrypt.hash(password, saltRounds, function (err, hash) {

            if (err) {
                dbConn.end();
                return callback(err, null);
            }

            var insertUserSql =
                "INSERT INTO users(username,email,password,type,profile_pic_url) VALUES(?,?,?,?,?)";

            dbConn.query(
                insertUserSql,
                [username, email, hash, type, profile_pic_url],
                function (err, results) {

                    dbConn.end();

                    if (err) {
                        return callback(err, null);
                    }

                    return callback(null, results);
                }
            );
        });
    });
}

```

## A07 — Identification & Authentication Failures (Brief)
### Finding 2: Hardcoded / Weak JWT Secret Key ###

Type of flaw: Identification & Authentication Failures — Weak session token signing mechanism allowing token forging due to hardcoded credentials.

Location: Assignment/BackEndServer/config/config.js lines 1–2 (or your exact config file path)

<img width="452" height="78" alt="image" src="https://github.com/user-attachments/assets/c9392fb8-ed5d-44b6-a681-11298581a089" />

## Reccommendation
To mitigate this risk, cryptographic secrets must be completely decoupled from the application source code.

- Utilize Environment Variables: Move the JWT secret key out of config.js and into an external environment file (e.g., a .env file) that resides strictly on the local hosting environment.
- Update Source Control Configuration: Ensure that the .env file is explicitly listed in the project's .gitignore file to prevent it from ever being accidentally committed to the version control repository.
- Implement a Secret Management System: For production environments, consider leveraging a dedicated secret management service (such as AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault) to dynamically inject sensitive credentials at runtime.

## Remediation Example
1. Create a .env file (Stored locally, NEVER committed):
<img width="953" height="545" alt="image" src="https://github.com/user-attachments/assets/e11246d8-efc1-4593-9ad9-edb566053e72" />

```bash
# =========================
# APPLICATION CONFIG
# =========================
PORT=8081

# =========================
# DATABASE CONFIG
# =========================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_database_password
DB_NAME=assignment2

# =========================
# JWT AUTHENTICATION
# =========================
JWT_SECRET=Assignment2key

# =========================
# SECURITY / ENVIRONMENT
# =========================
NODE_ENV=development
```
2. Update config.js to read from the environment:
<img width="935" height="518" alt="image" src="https://github.com/user-attachments/assets/d9ea0934-7a63-41d2-9122-e183eb918cc6" />

```bash
require('dotenv').config();

module.exports.key = process.env.JWT_SECRET;
```

3. Add .gitignore to prevent secret leakage

To ensure sensitive configuration files are not exposed in version control, the .env file must be excluded from the repository using .gitignore.
``` bash
# Environment variables
.env

# Dependency folders
node_modules/

# Logs
logs
*.log

# OS files
.DS_Store
```

### Impact of Fix

Implementing secure secret management improves system security by:

Preventing JWT secret exposure through version control leaks
Protecting authentication integrity
Reducing risk of credential compromise
Ensuring sensitive environment variables are not publicly accessible
Aligning with OWASP A07:2021 security best practices

## A07 — Identification & Authentication Failures (Optional)
### Finding 3: Session Hijacking via Client-Side Token Substitution ###

#### Overview

This finding describes a security weakness in the application’s session management mechanism. The application stores JWT authentication tokens in localStorage, which introduces risks related to token exposure, manipulation, and session reuse.

Although JWT itself is secure when properly signed, improper storage and handling on the client side weakens overall session security.

#### Affected Component
Frontend authentication module
Browser localStorage session storage
API requests using JWT Authorization headers
#### Technical Description

The application stores authentication data in the browser after login:

localStorage.setItem('Token', token);
localStorage.setItem('user', JSON.stringify(user));

These values are used to maintain user sessions and authenticate API requests.

Because localStorage is accessible via browser developer tools and JavaScript execution context, stored tokens can be:

Viewed
Modified
Replaced
Extracted by malicious scripts
#### Security Issue

The system relies on client-side stored JWT tokens as a session identifier.

If an attacker obtains a valid token, it can be reused in another session until expiration. This is commonly referred to as:

Session Token Replay / Token Substitution (Session Hijacking Concept)

#### Security Weaknesses Identified
1. Insecure Token Storage

Storing tokens in localStorage exposes them to:

Browser DevTools access
Cross-Site Scripting (XSS) attacks
Malicious browser extensions
2. Weak Trust in Client-Side Data

The application stores user session data locally:

const user = JSON.parse(localStorage.getItem('user'));

This introduces risk if frontend logic relies on this data for authorization decisions instead of backend validation.

3. Missing Secure Cookie Controls

The application does not use:

HttpOnly cookies
Secure cookie flags
SameSite protection

This increases exposure of authentication credentials.

#### Testing Methodology
Browser Developer Tools
Inspected localStorage
Verified JWT token and user object storage
Manually modified stored values to observe session behavior
Postman API Testing

Tested endpoints:

GET /users
GET /CheckRole

Example request:

GET /CheckRole HTTP/1.1
Authorization: Bearer <JWT_TOKEN>

Observations:

Endpoints rely on JWT for authentication
Access control depends on backend validation of token claims
Frontend Network Inspection

Monitored requests using DevTools:

fetch('http://localhost:8081/CheckRole', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

Confirmed that authentication relies on client-supplied tokens.

#### Impact
Potential session reuse if tokens are exposed
Risk of account impersonation in compromised environments
Weak separation between client-side and server-side security logic
Increased exposure to XSS-based token theft

Risk Level: Medium

#### Recommendations

- 1. Use HttpOnly Cookies

Store JWTs in:

HttpOnly cookies
Secure flag enabled (HTTPS only)
SameSite policy set to Strict or Lax

- 2. Avoid localStorage for Sensitive Data

Do not store:

JWT tokens
Authorization-critical user data

- 3. Enforce Backend Authorization

Ensure:

Every protected route validates JWT properly
Role checks are performed server-side
No reliance on frontend user state for access control

- 4. Implement XSS Protections
Input sanitization for all user inputs
Implement Content Security Policy (CSP)
Avoid unsafe DOM usage such as innerHTML

#### Conclusion

The application’s authentication system is functional but exposed to risks due to insecure token storage in localStorage. While JWT integrity remains valid, the current implementation increases the attack surface for token theft and session reuse.

Improving storage mechanisms and enforcing stricter backend authorization will significantly enhance overall security posture.


