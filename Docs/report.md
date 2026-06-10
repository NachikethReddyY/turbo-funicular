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
The core authentication failure spans across both the frontend client-side session management and the backend persistence layer. Below are the specific code implementations introducing these flaws:

- 1. Frontend Client-Side: Insecure Credential Exposure (localStorage)
Located in the frontend login script handler, the application captures the user's raw input strings and explicitly writes the plaintext password into persistent browser storage when the "Remember Me" option is checked.

<img width="581" height="279" alt="image" src="https://github.com/user-attachments/assets/3b90d35d-65b7-482e-b6f6-fd0ac3bdd043" />

## Impact

Passwords are stored in plain text within the database instead of being hashed before storage. If an attacker gains access to the database through a data breach, misconfiguration, or another vulnerability, all user passwords would be immediately exposed.

### Potential Consequences

- Unauthorized access to user accounts.
- Credential stuffing attacks against other services where users reuse the same password.
- Exposure of sensitive user information and application data.
- Potential privilege escalation if administrator credentials are compromised.
- Non-compliance with security best practices outlined in OWASP A07:2021 – Identification and Authentication Failures.

### Tools Used
- MySQL Workbench  
- Browser Developer Tools  

---

### Risk Assessment

**Risk Level:** High  

Storing passwords in plain text is a critical security vulnerability. If the database is compromised, attackers can directly access user credentials without needing to perform any cracking or decryption. This significantly increases the severity of the breach, potentially leading to unauthorized account access and data exploitation.

---

### Recommendation
To mitigate the risk of credential exposure, the application was updated to implement secure password handling using two complementary approaches:

- Method 1: bcrypt password hashing (application-level fix)
- Method 2: AWS Cognito for authentication (cloud-based identity management)

Previously, passwords were stored in plain text, allowing any database compromise to immediately expose user credentials. The following methods address this issue using both local and cloud-based security improvements.

### Method 1 — bcrypt Password Hashing (Application-Level Fix)

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

# Example of Fix

To mitigate the risk of credential exposure, the application was updated to implement **bcrypt password hashing** during user registration and authentication. Previously, passwords were stored in plain text, allowing anyone with access to the database to immediately view and misuse user credentials.

By implementing bcrypt, passwords are transformed into a one-way cryptographic hash before being stored in the database. This ensures that the original password cannot be directly recovered, even if the database is compromised. During login, the application compares the user-provided password against the stored hash using bcrypt's verification mechanism rather than performing a direct string comparison.

The figure below shows the modifications made to integrate bcrypt hashing into the application.

<img width="291" height="59" alt="image" src="https://github.com/user-attachments/assets/36f19f7b-4005-4d8f-9902-a006658c111e" />

## Registration Logic (`model/user.js`)

During account creation, the user's password is hashed using bcrypt before being inserted into the database. Instead of storing the original password, the generated hash value is stored.

```javascript
bcrypt.hash(password, saltRounds, function (err, hash) {
    var insertUserSql =
    "INSERT INTO users(username,email,password,type,profile_pic_url) VALUES(?,?,?,?,?)";

    dbConn.query(insertUserSql,
        [username, email, hash, type, profile_pic_url],
        function (err, results) {
            ...
        });
});
```

## Authentication Logic (`model/user.js`)

During login, the application retrieves the stored password hash associated with the user's email address and uses `bcrypt.compare()` to verify the supplied password.

```javascript
bcrypt.compare(password, user.password, function (err, isMatch) {
    if (isMatch) {
        var token = jwt.sign(
            { userid: user.userid, type: user.type },
            config.key,
            { expiresIn: 86400 }
        );
    }
});
```

## Security Improvements Achieved

* Passwords are no longer stored in plain text.
* Database compromise does not immediately reveal user credentials.
* Attackers cannot directly read passwords from database records.
* bcrypt automatically incorporates salting, reducing the effectiveness of rainbow table attacks.
* Authentication is performed through secure hash comparison rather than direct password matching.

## Result

Before the fix, a database record contained passwords in readable form:

```bash
Password: mypassword123
```

After implementing bcrypt, the database stores only a cryptographic hash:

```bash
$2b$10$QkJzjYkJ0vR5v3q8FQ8i6eJrjN5N6xR3Kz4F8W2sY8hL9mA7dPqXG
```

With this change, even if an attacker gains access to the database, they cannot directly determine a user's original password. This significantly reduces the risk of credential theft, unauthorized access, and account compromise.

<img width="621" height="22" alt="image" src="https://github.com/user-attachments/assets/f4bbb086-833b-4f3c-853f-7ee338c0ef3d" />

### Method 2 — AWS Cognito (Cloud-Based Authentication Fix)
To further improve security, AWS Cognito is used as a managed authentication service.

Instead of storing and managing user passwords within the application database, authentication is delegated to AWS Cognito.

---

## A07 — Identification & Authentication Failures (Brief)
### Finding 2: Hardcoded / Weak JWT Secret Key ###

Type of flaw: Identification & Authentication Failures — Weak session token signing mechanism allowing token forging due to hardcoded credentials.

### Source Code Evidence (Repository Leakage)
During a static code analysis of the source code repository, hardcoded symmetric signing keys were discovered directly committed to version control:

<img width="959" height="398" alt="image" src="https://github.com/user-attachments/assets/9cc7e54b-ebe9-46c3-90f0-cc50ab95d06c" />

### Threat Actor Reconnaissance Analysis:
1. **Repository Discovery:** A malicious actor uses automated scanners or manual search GitHub syntax (`filename:config.js "secret"`) to find exposed credential files across public or shared code repositories.
2. **Plaintext Extraction:** Looking at line 1 and 2, the application's global JWT signing key `secret = 'Assignment2key'` is completely unmasked.
3. **Exploitation Vector:** An attacker does not need to compromise the hosting server to exploit this. With this single string, they can locally forge valid administrative JSON Web Tokens (JWTs), present them to the public application API endpoints, and gain immediate unauthorized access to any user account on the platform.

Location: Assignment/BackEndServer/config/config.js lines 1–2 (or your exact config file path)

<img width="452" height="78" alt="image" src="https://github.com/user-attachments/assets/c9392fb8-ed5d-44b6-a681-11298581a089" />

## Reccommendation
To mitigate this risk, cryptographic secrets must be completely decoupled from the application source code.

- Utilize Environment Variables: Move the JWT secret key out of config.js and into an external environment file (e.g., a .env file) that resides strictly on the local hosting environment.
- Update Source Control Configuration: Ensure that the .env file is explicitly listed in the project's .gitignore file to prevent it from ever being accidentally committed to the version control repository.
- Implement a Secret Management System: For production environments, consider leveraging a dedicated secret management service (such as AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault) to dynamically inject sensitive credentials at runtime.

## Remediation Example
There are two common methods to remediate hardcoded secrets and sensitive credentials within an application.

### Method 1: Environment Variables (.env) with .gitignore
This approach stores sensitive values such as database credentials and JWT secrets in a local `.env` file that is excluded from version control through `.gitignore`. This prevents secrets from being accidentally exposed in source code repositories.

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

3. Add a `.gitignore` File

Add a `.gitignore` file to the root directory of the project and include the `.env` file within it.

```bash
.env
```

### Benefits of this approach 
- Removes secrets from source code.
- Prevents accidental exposure through GitHub repositories.
- Allows different configurations for development, testing, and production environments.
- Easy to implement and maintain for small to medium-sized applications.

### Method 2: AWS Secrets Manager (Recommended for Production)
While environment variables (.env) protect source control history, production servers shouldn't keep static credentials saved to a local hard disk file. Instead, cloud architectures rely on a centralized credential vault like AWS Secrets Manager.

### Step 1: Run the modular AWS SDK v3 dependency installer inside your backend environment path:

<img width="662" height="182" alt="image" src="https://github.com/user-attachments/assets/e3fae965-c051-459f-bfda-18a160780e7e" />

### Step 2: Secure Code Implementation Example
Replace standard static file reading blocks inside your initialization scripts with a dynamic asynchronous call directly into AWS Secrets Manager.

```bash
// Location: Assignment/BackEndServer/config.js
require('dotenv').config(); // Hydrate short-term cloud session variables locally

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Client hooks directly into your configured environment profile variables
const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

async function fetchApplicationSecrets() {
  const secretIdName = "assignment/backend/config"; // Case-sensitive cloud identifier path

  try {
    const cloudResponse = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretIdName,
        VersionStage: "AWSCURRENT"
      })
    );

    if (cloudResponse.SecretString) {
      const parsedSecrets = JSON.parse(cloudResponse.SecretString);
      
      // Map retrieved properties directly to application runtime layers
      process.env.JWT_SECRET = parsedSecrets.JWT_SECRET;
      process.env.DB_PASSWORD = parsedSecrets.DB_PASSWORD;
      
      console.log("[SECURITY] System runtime properties configured via AWS Secrets Manager successfully.");
      return parsedSecrets;
    }
  } catch (error) {
    console.error("[CRITICAL ERROR] Failed to fetch credentials from AWS Vault:", error);
    process.exit(1); // Force-close the application if it cannot fetch configurations safely
  }
}

module.exports = { fetchApplicationSecrets };
```

### Step 3: Set up the learning lab in AWS
Set up the secret in the AWS Learning Lab environment.

<img width="491" height="301" alt="image" src="https://github.com/user-attachments/assets/26488ae0-4914-4dd0-a359-5bbee75ba04c" />

Steps:
- Open AWS Secrets Manager
- Create a new secret
- Store required credentials securely
- Configure IAM permissions for access
- Use the Secret ARN in your application

### Step 4: Secure Application Bootstrap Configuration (server.js)
Because fetching credentials from an external cloud provider is an asynchronous network operation, server.js cannot be configured using standard synchronous execution blocks. If left unchanged, Express will bind to port 8081 immediately upon boot—before the AWS SDK finish populating the application memory—resulting in standard routing and database connection failures.

To fix this, the application startup routine was wrapped inside an asynchronous lifecycle bootstrap sequence. This ensures that the web application engine stalls local port binding until the remote AWS Secrets Manager handshake resolves completely.

```bash
/*
Summary: The server.js is used to start the backend server securely with dynamic configuration.
*/

var express = require('express');
var serveStatic = require('serve-static');
var app = require('./controller/app.js');

// Destructure the imported module to fetch the function wrapper accurately
const { fetchApplicationSecrets } = require('./config.js'); 

var port = 8081;

app.use(serveStatic(__dirname + '/public')); 

// Secure Asynchronous Bootstrap Wrapper
async function bootstrapServer() {
    try {
        console.log("[STARTUP] Attaching to AWS Secrets Manager service space...");
        
        // 1. Enforce an execution hold until AWS secrets finish loading completely into memory
        await fetchApplicationSecrets();

        // 2. NOW bind the hosting port listener safely once execution variables exist
        app.listen(port, function(){
            console.log('[INFO] Web App Hosted successfully at http://localhost:%s', port);
        });

    } catch (bootstrapError) {
        console.error("[CRITICAL SHUTDOWN] Bootstrap sequence intercepted a terminal failure:", bootstrapError);
        process.exit(1);
    }
}

// Fire the secure boot sequence execution
bootstrapServer();
```

### Step 5: Final Remediation Verification and Runtime Logs
To test and verify the structural integrity of the code integrations across both config.js and server.js, execute npm start inside the active console workspace terminal (/BackEndServer).

The runtime diagnostics show that the asynchronous bootstrap loop successfully grabs the temporary AWS Academy Learner Lab environment credentials, reaches out to the designated container vault, extracts the properties, and activates the web listener safely:

<img width="500" height="74" alt="image" src="https://github.com/user-attachments/assets/850af3c1-41da-4fb5-8af1-62b517e5ecbf" />

### Remediation Metrics Confirmed:
- Zero Disk-Persistent Plaintext Secrets: Hardcoded production configuration keys have been completely eradicated from codebase repository assets and commit history.
- Fail-Closed Verification Complete: The application successfully authorized its identity credentials against AWS, resolving the previous ResourceNotFoundException.
- Deferred Network Exposure: The backend infrastructure successfully held port 8081 in a closed state until database parameters were completely mapped, blocking unauthorized access requests during an unconfigured initialization phase.




