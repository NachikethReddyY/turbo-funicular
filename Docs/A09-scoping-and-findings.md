# A09 — Security Logging & Monitoring Failures: Scoping Document

## Overview

OWASP A09 covers failures related to security logging and monitoring. The application has **two distinct categories of issues**:

1. **No Audit Logging** — No structured security event logs for authentication, authorization, or sensitive operations
2. **Information Leakage via Logging** — Sensitive data logged to console (tokens, error details) and enumeration vulnerabilities in error responses

---

## What We're Looking For (Scope)

### Category 1: Missing Audit Logging

**Definition:** The application does not log security-relevant events in a way that allows detection, investigation, or compliance verification.

**Specific Issues to Document:**
- No structured logging on authentication (login success/failure, account creation)
- No logging of authorization checks (failed access attempts)
- No logging of sensitive operations (game deletion, user management, review posting)
- No timestamps, user IDs, IP addresses, or action details recorded
- No distinction between different event types (error vs. warning vs. info)
- No persistent log storage (only transient console output)

**Impact:**
- Impossible to detect brute-force login attempts in progress
- Cannot investigate who deleted data or when
- No forensic timeline for incident response
- Violates compliance requirements (ISO 27001, SOC 2, PCI-DSS)

---

### Category 2: Information Leakage via Logging

**Definition:** Sensitive data is logged to console or error responses, exposing secrets, tokens, or database schema details.

**Sub-Category 2a: Console Logging of Sensitive Data**
- Raw error objects logged to console (reveals SQL structure, stack traces)
- JWT tokens logged to console (if server logs are accessible, tokens can be compromised)
- Request headers logged (includes Authorization Bearer tokens)
- Debug information logged without filtering

**Sub-Category 2b: Enumeration via Error Messages**
- Different error messages for username existence ("already exists") vs. email existence
- Allows attackers to enumerate valid usernames/emails without brute-forcing passwords
- Example: "The username provided already exists" reveals which accounts are registered

**Impact:**
- Token leakage if server logs are compromised or visible in deployment platform logs
- SQL injection detection aid (SQL errors reveal query structure)
- User enumeration attacks possible
- Privacy violations (credential lists revealed)

---

## Codebase Issues Found

### Issue 1: console.log(err) in Error Handlers

**Files Affected:**
- `controller/app.js` — 25 instances
- `model/users.js` — 2 instances
- `server.js` — 1 instance (acceptable startup message)

**What's Being Logged:**
Raw error objects containing SQL errors, stack traces, database schema information.

**Specific Locations in app.js:**
```
Line 78:   console.log(err);     // GET /users error
Line 106:  console.log(err);     // POST /users/login error
Line 175:  console.log(err);     // POST /users error
Line 201:  console.log(err);     // GET /users/:userid error
Line 228:  console.log(err);     // GET /users error
Line 268:  console.log(err);     // POST /category error
Line 278:  console.log(err);     // POST /category error
Line 288:  console.log(err);     // POST /category error
Line 318:  console.log(err);     // GET /category error
Line 355:  console.log(err);     // POST /platform error
Line 366:  console.log(err);     // POST /platform error
Line 405:  console.log(err);     // POST /platform error
Line 415:  console.log(err);     // POST /platform error
Line 451:  console.log(err);     // POST /game error
Line 467:  console.log(err);     // POST /game error
Line 479:  console.log(err);     // POST /game error
Line 510:  console.log(err);     // GET /game error
Line 538:  console.log(err);     // DELETE /game error
Line 569:  console.log(err);     // POST review error
Line 598:  console.log(err);     // GET review error
Line 661:  console.log(err);     // GET review error
+ 4 more instances (lines 445, 462, price debug logging)
```

**Specific Locations in users.js:**
```
Line 131:  console.log(err);          // Error in insertUser
Line 143:  console.log("Err: " + err);  // Error in loginUser
Line 154:  //console.log("@@token " + token);  // Token logging (commented but evidence it was there)
```

**Evidence:** These log full error objects from the database driver, exposing SQL syntax, table names, column names, and constraint violations.

---

### Issue 2: Token Logging

**File:** `auth/verifyToken.js`
**Current Status:** Line 17 has `//console.log(token);` (commented out)
**Risk:** Although currently commented, this demonstrates the code was logging raw JWT tokens to stdout.

---

### Issue 3: Enumeration via Error Messages

**File:** `controller/app.js`
**Specific Lines:**
```
Line 272: res.send(`{"Message":"The username provided already exists."}`);
Line 282: res.send(`{"Message":"The email provided already exists."}`);
Line 359: res.send(`{"Message":"The category name provided already exists."}`);
Line 409: res.send(`{"Message":"The platform name provided already exists."}`);
Line 638: res.send(`{"Message":"Game not found"}`);
```

**Vulnerability:**
- Different messages for different failure types
- Attackers can determine which usernames are registered by trying to create accounts
- Example: If they get "username already exists", they know the account is registered; if they get a generic error or different message, they know it's not

---

### Issue 4: Frontend Console Error Logging

**Files Affected:**
```
login.html (line 109):      console.error(e);
admin.html (line 95):       console.error(e);
register.html (line 154):   console.error(err);
newHome.html (line 69):     console.error(e);
```

**Issue:** Errors are logged to browser console, which could expose sensitive information if:
- User shares browser console output
- Someone has access to user's machine
- Error messages contain sensitive details about the API or database

**Note:** Browser console errors are less critical than server-side logging, but still represent poor error handling practices.

---

### Issue 5: Debug/Price Logging in app.js

**Specific Lines:**
```
Line 159: console.log("..logging out.");     // Logout message
Line 445: console.log(price);                // Debug price logging
Line 462: console.log(price);                // Debug price logging
```

**Issue:** These are debug statements left in production code. While less critical, they show lack of code review and inconsistent logging practices.

---

## What's Missing (No Audit Trail)

### User Registration (`POST /users`) — Lines 244–302
- ❌ No logging of successful registration
- ❌ No logging of failed registration attempts
- ❌ No timestamp recorded
- ❌ No user ID recorded (only available after insertion)

### User Login (`POST /users/login`) — Lines 82–115
- ❌ No logging of successful login
- ❌ No logging of failed login attempts
- ❌ No IP address recorded
- ❌ No timestamp recorded
- ❌ No way to detect brute-force attacks

### Game CRUD Operations (`POST /game`, `DELETE /game/:id`)
- ❌ No logging of who created/deleted games
- ❌ No logging of when operations occurred
- ❌ No audit trail for data modification

### Category/Platform CRUD Operations
- ❌ Same as above — no audit logging

### Review Posting (`POST /users/:uid/game/:gid/review`)
- ❌ No logging of which user posted reviews
- ❌ No audit trail for content moderation

### Unauthorized Access Attempts
- ❌ No logging of 403 Forbidden responses
- ❌ No detection of repeated access attempts

---

## Summary: Issue Inventory

| Category | Issue | File | Line(s) | Count | Severity |
|----------|-------|------|---------|-------|----------|
| Error Logging | console.log(err) | app.js | 78-661 | 25 | High |
| Error Logging | console.log(err) | users.js | 131, 143 | 2 | High |
| Token Logging | console.log(token) | verifyToken.js | 17 | 1 | High |
| Enumeration | Error messages leak user existence | app.js | 272, 282, 359, 409 | 4 | High |
| Debug Logging | console.log (debug info) | app.js | 159, 445, 462 | 3 | Medium |
| Frontend Logging | console.error() | login.html, admin.html, register.html, newHome.html | 109, 95, 154, 69 | 4 | Medium |
| **Missing Audit Logging** | No security event logging | All endpoints | N/A | ALL | Critical |

---

## Screenshots to Capture

/tmp/handoff-a09-screenshots-and-report.md

### Backend Console Logging
1. **Backend Console Output (No Audit Trail)**
   - Start server
   - Perform actions: register user, login, delete game
   - Capture console showing only `console.log(err)` on errors, no structured events
   - File: `08-backend-console-no-logging.png`

2. **Error Response with Sensitive SQL Info**
   - Trigger a SQL error (via injection or malformed input)
   - Capture server console showing raw SQL error
   - File: `09-console-sql-error-exposed.png`

### Enumeration Attack Evidence
3. **Username Enumeration via Error Message**
   - POST /users with existing username (e.g., "user1")
   - Capture response: `{"Message":"The username provided already exists."}`
   - File: `10-enumeration-username-exists.png`

4. **Email Enumeration via Error Message**
   - POST /users with existing email
   - Capture response: `{"Message":"The email provided already exists."}`
   - File: `11-enumeration-email-exists.png`

5. **Non-Existing Username (Different Error or Generic)**
   - POST /users with new username/email to show the contrast
   - Shows that different error messages reveal user existence
   - File: `12-enumeration-username-contrast.png`

### Frontend Console Logging
6. **Frontend Browser Console Errors**
   - Open admin.html
   - Open browser Developer Tools (F12)
   - Perform error-triggering action
   - Capture console showing console.error() output
   - File: `13-frontend-console-error.png`

### Code Snapshots
7. **app.js Error Logging Pattern**
   - Screenshot showing multiple console.log(err) statements
   - File: `code/app.js-console-logging-pattern.png`

8. **verifyToken.js Token Logging (commented)**
   - Screenshot showing line 17 with commented token logging
   - File: `code/verifyToken.js-token-logging.png`

9. **users.js Error and Token Logging**
   - Screenshot showing lines 131, 143, 154
   - File: `code/users.js-sensitive-logging.png`

10. **Enumeration Error Messages**
    - Screenshot of error messages in controller/app.js (lines 272, 282, 359, 409)
    - File: `code/app.js-enumeration-errors.png`

---

## Testing Methodology

### Test 1: Verify Error Logging Captures SQL Details
1. Start backend server
2. Make malformed request (e.g., POST /users with invalid data)
3. Check server console for SQL error output
4. Verify that SQL query structure, table names, column names are visible

### Test 2: Verify No Audit Logging Exists
1. Register new user
2. Check server console and logs — no audit entry for registration
3. Login with that user
4. Check server console — no audit entry for login
5. Perform admin action (delete game)
6. Check server console — no audit entry for deletion

### Test 3: Enumeration Attack
1. POST /users with body `{"username":"testuser123","email":"test@example.com","password":"pass"}`
2. Note the success response or error message
3. POST /users with body `{"username":"testuser123","email":"different@example.com","password":"pass"}` (same username, different email)
4. Observe different error message ("username already exists")
5. Demonstrates enumeration is possible

### Test 4: Frontend Error Logging
1. Open login.html in browser
2. Open Developer Tools Console (F12)
3. Attempt an action that causes an error (e.g., login with network failure)
4. Observe `console.error()` output in browser console

---

## Findings Structure (For Report)

### Finding 1 (A09): Missing Audit Logging on Sensitive Operations (DETAILED)
- **CVSS Score:** [To be calculated]
- **Severity:** Critical
- **Impact:** Impossible to detect abuse, investigate incidents, or ensure compliance

### Finding 2 (A09): Information Leakage via Console Logging & Error Messages (BRIEF)
- **CVSS Score:** [To be calculated]
- **Severity:** High
- **Impact:** Token exposure, user enumeration, SQL structure leakage

---

## Next Steps

1. ✅ **Scope Review** (This document) — Understand what A09 covers and what issues exist
2. ⏳ **Screenshot Collection** — Capture all evidence from codebase and running application
3. ⏳ **Report Writing** — Document findings with 7-point structure
4. ⏳ **Fixes Implementation** — Add structured logging, remove sensitive logging, fix enumeration
5. ⏳ **Fix Verification** — Test that all fixes work correctly

---

## Key Takeaway

**The application has ZERO structured logging of security events.** All error handling uses bare `console.log()` which exposes sensitive data (SQL errors, tokens) and provides no audit trail. Additionally, error messages leak information that allows user enumeration attacks.

This is a **critical finding** because:
- Breaches cannot be detected
- Incident response is impossible
- Compliance requirements cannot be met
- Attackers can enumerate users and understand system architecture from error messages
