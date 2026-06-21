---
author: Keefe Chen Lin Li
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report — OWASP A07 Identification & Authentication Failures

## Application Overview

This report presents the security vulnerability analysis performed on the developed web application for the ST2515 Secure Coding Project. The application follows a client-server architecture consisting of a frontend web interface and a Node.js backend API connected to a MySQL database.

The frontend is responsible for user interaction, authentication requests, and displaying application features, while the backend provides REST API endpoints for user management, authentication, and application operations. The system uses JavaScript, Node.js, Express.js, MySQL, and JWT-based authentication.

This report focuses on OWASP Top 10 security risks, specifically:

- A07: Identification and Authentication Failures
- A01: Broken Access Control
- A03: Injection
- A04: Insecure Design

The assessment identifies security weaknesses, demonstrates possible exploitation methods, explains the impact, and provides secure coding recommendations and fixes.

---

# Finding 1 — Plain-text Password Storage and Insecure Credential Handling

## 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures

The application originally stored user passwords in plain text instead of applying secure password hashing.

This violates secure coding principles because passwords are highly sensitive authentication credentials and should never be stored in a reversible or readable format.

If an attacker gains access to the database, all user passwords can immediately be viewed without requiring password cracking.

---

## 2. Exploitation

An attacker can exploit this vulnerability by obtaining access to the user database through another vulnerability, leaked database backup, or unauthorized database access.

Example:


GET /users
Host: localhost:8081


Before the fix, the server returned:

```json
[
 {
  "userid":1,
  "username":"testuser",
  "email":"test@email.com",
  "password":"password123"
 }
]
```
The attacker can directly reuse the exposed password to login.
# ST2515 Secure Coding Project

## Vulnerability Analysis Report — OWASP A07 Identification & Authentication Failures

**Author:** Keefe Chen Lin Li  
**Module:** ST2515 Secure Coding  
**Date:** June 2026  

---

# Finding 1 — Plain-text Password Storage and Insecure Credential Handling

## 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures

The application stores user passwords in plain text instead of securely hashing them before storing them in the database.

This violates secure coding principles because passwords are sensitive authentication credentials and should never be stored in a readable format.

If an attacker gains access to the database, all user credentials can immediately be exposed.

---

## 2. Exploitation

An attacker can exploit this vulnerability by obtaining access to the database through another vulnerability or unauthorized access.

Example:

```http
GET /users
Host: localhost:8081
```

Before fixing:

```json
{
 "username":"testuser",
 "email":"test@email.com",
 "password":"password123"
}
```

Impact:

- Account takeover
- Credential reuse attacks
- Exposure of user information

---

## 3. Database Storage

Affected table:

```
users
```

Affected columns:

| Column | Description |
|---|---|
| userid | User identifier |
| username | Username |
| email | User email |
| password | Authentication password |
| type | User role |

Before fix:

```
password = password123
```

Password was stored as readable plaintext.

After fix:

```
password = $2a$10$xxxxxxxxxxxxxxxx
```

Password is stored using bcrypt hashing.

---

## 4. Affected Code

File:

```
Assignment/BackEndServer/model/users.js
```

Vulnerable code:

```javascript
INSERT INTO users(username,email,password,type)
VALUES(username,email,password,type)
```

Problem:

The raw password value is directly inserted into the database.

---

## 5. Recommendations & Fix Code

Passwords should be hashed before storage.

Fixed code:

```javascript
bcrypt.hash(password, saltRounds, function(err, hash){

    dbConn.query(
    "INSERT INTO users(username,email,password,type) VALUES(?,?,?,?)",
    [
      username,
      email,
      hash,
      type
    ]);

});
```

---

## 6. Testing Process

Before fix:

Request:

```http
POST /users
```

Database:

```
password123
```

After fix:

Database:

```
$2a$10$N9qo8uLOickgx2ZMRZoMye
```

The original password is no longer readable.

---

## 7. Tools Used

| Tool | Purpose |
|---|---|
| MySQL Workbench | Checked password storage format |
| Browser DevTools | Checked authentication data |
| Postman | Tested API responses |

---

# Finding 2 — Hardcoded JWT Secret Key

## 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures

The JWT secret key is stored directly inside the source code.

If attackers obtain the source code, they can potentially create forged authentication tokens.

---

## 2. Exploitation

Example:

```http
Authorization: Bearer <fake-token>
```

Impact:

- Authentication bypass
- Privilege escalation
- Account impersonation

---

## 3. Database Storage

Not applicable.

The vulnerability affects application configuration.

---

## 4. Affected Code

File:

```
Assignment/BackEndServer/config/config.js
```

Vulnerable:

```javascript
module.exports.key="Assignment2key";
```

---

## 5. Recommendations & Fix Code

Move secrets into environment variables.

Fixed:

```javascript
require('dotenv').config();

module.exports.key =
process.env.JWT_SECRET;
```

Example:

```
JWT_SECRET=secure_random_key
```

---

## 6. Testing Process

Before:

JWT secret visible in source code.

After:

Secret removed from source and loaded securely.

---

## 7. Tools Used

| Tool | Purpose |
|---|---|
| VS Code | Reviewed configuration |
| Postman | Tested JWT authentication |

---

# Finding 3 — Session Hijacking via Client-Side Token Storage

## 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures

The application stores JWT tokens inside browser localStorage.

Since localStorage can be accessed using JavaScript, stolen tokens may be reused by attackers.

---

## 2. Exploitation

Token retrieval:

```javascript
localStorage.getItem("Token")
```

Reuse:

```http
GET /CheckRole

Authorization: Bearer stolen_token
```

Impact:

- Session impersonation
- Unauthorized access

---

## 3. Database Storage

Not applicable.

The vulnerability exists in browser-side session management.

---

## 4. Affected Code

Frontend:

```javascript
localStorage.setItem(
"Token",
token
);
```

---

## 5. Recommendations & Fix Code

Use secure cookies:

```javascript
res.cookie(
"token",
token,
{
 httpOnly:true,
 secure:true,
 sameSite:"strict"
});
```

---

## 6. Testing Process

Before:

Token visible in browser storage.

After:

Token cannot be accessed by JavaScript.

---

## 7. Tools Used

| Tool | Purpose |
|---|---|
| Chrome DevTools | Checked localStorage |
| Postman | Tested authentication |

---

# Finding 4 — Insecure Transmission of Authentication Data

## 1. Vulnerability & Type of Flaw

**Type:** OWASP A07 — Identification and Authentication Failures

The application communicates authentication requests using HTTP instead of HTTPS.

This allows credentials and authentication tokens to travel without encryption.

---

## 2. Exploitation

Attacker intercepts:

```http
POST http://localhost:8081/users/login
```

Example:

```json
{
"email":"user@email.com",
"password":"password123"
}
```

Impact:

- Credential interception
- Token theft
- Man-in-the-middle attacks

---

## 3. Database Storage

Not applicable.

The vulnerability affects communication security.

---

## 4. Affected Code

Frontend:

```javascript
fetch(
"http://localhost:8081/users/login"
)
```

---

## 5. Recommendations & Fix Code

Use HTTPS:

```javascript
fetch(
"https://localhost:443/users/login"
)
```

Enable TLS certificates.

---

## 6. Testing Process

Before:

HTTP traffic readable.

After:

Traffic encrypted using TLS.

---

## 7. Tools Used

| Tool | Purpose |
|---|---|
| Browser DevTools | Inspected network traffic |
| Postman | Tested API requests |

---

# Conclusion

## Findings Summary

| Finding | Category | Severity |
|---|---|---|
| Plain-text Password Storage | A07 | High |
| Hardcoded JWT Secret | A07 | Medium |
| Client-Side Token Storage | A07 | Medium |
| Insecure Authentication Transmission | A07 | High |

---

## Root Cause

The main root cause was insufficient protection of authentication-related information.

Sensitive data such as passwords, tokens, and authentication requests were handled insecurely.

---

## Fixes Applied

- Implemented bcrypt password hashing
- Removed plaintext password storage
- Secured JWT secret management
- Improved token handling
- Recommended HTTPS communication

These improvements strengthen authentication security and reduce the risk of unauthorized access.
