# ST2515 Secure Coding Project

## Secure Vulnerability Analysis Report

**Author:** Keefe Chen Lin Li  
**Module:** ST2515 Secure Coding  
**Date:** June 2026  

---

# Vulnerability Analysis Report — OWASP A07 & A02

## Overview

This report presents the security vulnerability analysis conducted on the developed web application for the ST2515 Secure Coding Project.

The application follows a client-server architecture consisting of:

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js Express API
- Database: MySQL
- Authentication: JWT-based authentication

This report focuses on OWASP security categories:

- A07 — Identification and Authentication Failures
- A02 — Cryptographic Failures

The purpose of this assessment is to identify vulnerabilities, demonstrate exploitation methods, analyse security impact, and provide recommended secure coding improvements.

---

# Finding 1 — Plain-text Password Storage and Lack of Hashing

## 1. Vulnerability & Type of Flaw

**Type: OWASP A07 — Identification and Authentication Failures**

The application stores user passwords in plaintext instead of applying secure password hashing.

This violates secure coding principles because passwords should never be stored in readable form. If attackers gain database access, all user credentials are immediately exposed.

---

## 2. Exploitation

An attacker who gains access to the database can directly view stored passwords.

Example:

```
username: testuser
email: test@email.com
password: password123
```

The attacker does not need to crack the password because the value is already readable.

### Evidence

![Plaintext password stored in database](https://github.com/user-attachments/assets/637df0b0-6a13-4145-997b-93c8f948b0f2)

![Password visible in SQL Workbench](https://github.com/user-attachments/assets/8fee31e8-c8a8-4672-95df-90917641f237)

---

## Impact

- Account takeover
- Credential reuse attacks
- Exposure of user information
- Possible privilege escalation

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

Password stored as plaintext.

After fix:

```
password = $2a$10$N9qo8uLOickgx2ZMRZoMye
```

Password stored using bcrypt hashing.

---

# 4. Affected Code

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

# 5. Recommendations & Fix Code

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

# 6. Testing Process

Before fix:

Request:

```
POST /users
```

Database result:

```
password123
```

After fix:

Database result:

```
$2a$10$N9qo8uLOickgx2ZMRZoMye
```

The original password is no longer readable.

---

# 7. Tools Used

| Tool | Purpose |
|---|---|
| MySQL Workbench | Checked password storage format |
| Browser DevTools | Checked authentication storage |
| Postman | Tested API requests |

---

# Finding 2 — Hardcoded JWT Secret Key

## 1. Vulnerability & Type of Flaw

**Type: OWASP A07 — Identification and Authentication Failures**

The application stores the JWT secret key directly inside the source code.

If attackers obtain the source code, they may generate fake authentication tokens.

---

## 2. Exploitation

Attacker creates a forged token:

```
Authorization: Bearer fake-token
```

If the token is signed using the exposed secret, the attacker may bypass authentication.

Impact:

- Authentication bypass
- Account impersonation
- Privilege escalation

---

## 3. Database Storage

Not applicable.

This vulnerability affects application configuration.

---

# 4. Affected Code

File:

```
Assignment/BackEndServer/config/config.js
```

Vulnerable code:

```javascript
module.exports.key="Assignment2key";
```

---

# 5. Recommendations & Fix Code

Move secrets into environment variables.

Fixed:

```javascript
require('dotenv').config();

module.exports.key =
process.env.JWT_SECRET;
```

Example:

```env
JWT_SECRET=secure_random_key
```

---

# 6. Testing Process

Before:

JWT secret visible in source code.

After:

Secret removed from application files.

---

# 7. Tools Used

| Tool | Purpose |
|---|---|
| VS Code | Reviewed configuration files |
| Postman | Tested JWT authentication |

---

# Finding 3 — Session Hijacking via Client-Side Token Storage

## 1. Vulnerability & Type of Flaw

**Type: OWASP A07 — Identification and Authentication Failures**

The application stores JWT tokens inside browser localStorage.

localStorage can be accessed by JavaScript, making tokens vulnerable to theft through XSS attacks.

---

## 2. Exploitation

Token storage:

```javascript
localStorage.setItem("Token", token);
```

Attacker retrieves token:

```javascript
localStorage.getItem("Token")
```

Token replay:

```
GET /CheckRole

Authorization: Bearer stolen_token
```

Impact:

- Session impersonation
- Unauthorized access

---

## 3. Database Storage

Not applicable.

The vulnerability exists in browser-side session storage.

---

# 4. Affected Code

Frontend:

```javascript
localStorage.setItem(
"Token",
token
);
```

---

# 5. Recommendations & Fix Code

Use secure cookies.

Example:

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

# 6. Testing Process

Before:

Token visible in browser storage.

After:

Token cannot be accessed through JavaScript.

---

# 7. Tools Used

| Tool | Purpose |
|---|---|
| Chrome DevTools | Checked localStorage |
| Postman | Tested authentication |

---

# Finding 4 — Missing HTTPS Protection

## 1. Vulnerability & Type of Flaw

**Type: OWASP A02 — Cryptographic Failures**

The application uses HTTP communication instead of HTTPS.

Sensitive information such as passwords and tokens may be intercepted.

---

## 2. Exploitation

Attacker intercepts:

```
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

This vulnerability affects network communication.

---

# 4. Affected Code

Frontend:

```javascript
fetch(
"http://localhost:8081/users/login"
)
```

---

# 5. Recommendations & Fix Code

Use HTTPS:

```javascript
fetch(
"https://localhost:443/users/login"
)
```

Enable:

- TLS certificates
- Secure cookies
- HTTPS-only communication

---

# 6. Testing Process

Before:

HTTP traffic visible.

After:

Traffic encrypted using TLS.

---

# 7. Tools Used

| Tool | Purpose |
|---|---|
| Browser DevTools | Inspected network traffic |
| Postman | Tested HTTPS endpoints |

---

# Conclusion

## Findings Summary

| Finding | Category | Severity |
|---|---|---|
| Plain-text Password Storage | A07 | High |
| Hardcoded JWT Secret | A07 | Medium |
| Client-Side Token Storage | A07 | Medium |
| Missing HTTPS Protection | A02 | High |

---

## Root Cause

The main root cause was insufficient security controls around authentication and sensitive data handling.

Sensitive information was stored or transmitted insecurely.

---

## Fixes Applied

- Implemented bcrypt password hashing
- Removed plaintext password storage
- Moved JWT secrets into environment variables
- Improved token handling
- Recommended HTTPS communication

These improvements strengthen confidentiality, authentication integrity, and overall application security.

## Evidence Screenshots

### 1. Plaintext Password Stored in Database

The password was stored in readable plaintext inside the database.

![Plaintext password database evidence](https://github.com/user-attachments/assets/637df0b0-6a13-4145-997b-93c8f948b0f2)

![SQL Workbench password storage](https://github.com/user-attachments/assets/8fee31e8-c8a8-4672-95df-90917641f237)


---

### 2. Registration Sending Unhashed Password

The frontend sends the password directly to the backend without hashing before storage.

![Registration request evidence](https://github.com/user-attachments/assets/1a965573-3916-48bc-80db-a430d298f451)


---

### 3. Browser Local Storage Password Exposure

The application stores the password inside browser localStorage.

![Local storage password evidence](https://github.com/user-attachments/assets/1c32503e-d787-42c4-ab4d-17f1e1193c35)


---

### 4. MySQL Workbench Testing

Used to verify whether passwords were stored securely.

![MySQL Workbench testing](https://github.com/user-attachments/assets/59c0f3cd-9e79-4ad1-a339-38a39dad8a75)


---

### 5. Browser Developer Tools Testing

Used to inspect authentication data stored in the browser.

![Browser DevTools testing](https://github.com/user-attachments/assets/60543c09-f509-4fc1-a745-a87bf77ffc0f)


---

### 6. Postman API Testing

Used to test authentication endpoints and observe responses.

![Postman testing](https://github.com/user-attachments/assets/3478ab6d-6a8d-41a1-8106-acbc744f35da)


---

### 7. JWT Secret Exposure

The JWT secret was hardcoded inside the application configuration.

![JWT secret exposure](https://github.com/user-attachments/assets/c9392fb8-ed5d-44b6-a681-11298581a089)


---

### 8. Bcrypt Fix Implementation

Password hashing was implemented before storing passwords.

![Bcrypt fix](https://github.com/user-attachments/assets/36f19f7b-4005-4d8f-9902-a006658c111e)
