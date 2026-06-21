# A09 (Security Logging & Monitoring Failures) - Ready for Screenshots

## Quick Summary

We've identified **ALL A09 ISSUES** in the codebase. Now we just need to **capture screenshots as proof** before fixing anything.

---

## 2 Main A09 Findings Identified

### Finding 1: Missing Audit Logging (DETAILED)
**Severity:** CRITICAL  
**Issue:** Zero structured logging of security events  
**Evidence:** Backend console shows NO log entries for user registration, login, or admin actions

### Finding 2: Information Leakage & Enumeration (BRIEF)  
**Severity:** HIGH  
**Issue:** Sensitive data logged to console; error messages reveal user existence  
**Evidence:** console.log(err) exposes SQL details; enumeration errors show which users exist

---

## Issue Inventory (What We Found)

### Backend Issues

| Issue | File | Lines | Count | Type |
|-------|------|-------|-------|------|
| console.log(err) | app.js | 78, 106, 175, 201, 228, 268, 278, 288, 318, 355, 366, 405, 415, 451, 467, 479, 510, 538, 569, 598, 661 | 25 | Error Logging |
| console.log(err) | users.js | 131, 143 | 2 | Error Logging |
| console.log(token) | verifyToken.js | 17 (commented) | 1 | Token Logging |
| Debug logging | app.js | 159, 445, 462 | 3 | Debug Info |
| "already exists" error | app.js | 272, 282, 359, 409 | 4 | Enumeration |
| **NO AUDIT LOGGING** | All endpoints | N/A | ALL | Missing Logs |

### Frontend Issues

| Issue | File | Lines | Count | Type |
|-------|------|-------|-------|------|
| console.error() | login.html | 109 | 1 | Error Logging |
| console.error() | admin.html | 95 | 1 | Error Logging |
| console.error() | register.html | 154 | 1 | Error Logging |
| console.error() | newHome.html | 69 | 1 | Error Logging |

---

## Screenshots to Capture (10 Total)

### Backend Console Evidence (3 screenshots)

1. **08-backend-console-no-logging.png**
   - What: Backend console when registering a user
   - Expected: NO log entry for registration action
   - Proves: No audit logging exists
   - How: Start server, register user, screenshot console

2. **09-console-sql-error-exposed.png**
   - What: Backend console when SQL error occurs
   - Expected: Raw SQL error with table/column names visible
   - Proves: Sensitive error details logged to console
   - How: Trigger invalid request, screenshot error on console

3. **10-enumeration-username-exists.png**
   - What: API response when trying to register with existing username
   - Expected: `{"Message":"The username provided already exists."}`
   - Proves: Usernames can be enumerated
   - How: curl POST /users with existing username, capture response

### Enumeration Attack Evidence (2 screenshots)

4. **11-enumeration-email-exists.png**
   - What: API response when trying to register with existing email
   - Expected: `{"Message":"The email provided already exists."}`
   - Proves: Emails can be enumerated
   - How: curl POST /users with existing email, capture response

5. **12-enumeration-username-contrast.png**
   - What: Contrast - API response with NEW username (success or different error)
   - Expected: Different from "already exists" error
   - Proves: Different error messages reveal user existence
   - How: curl POST /users with new username, capture response

### Frontend Console Evidence (1 screenshot)

6. **13-frontend-console-error.png**
   - What: Browser Developer Tools console showing console.error()
   - Expected: Error output visible in console
   - Proves: Frontend logs errors to browser console
   - How: Open admin.html, F12, trigger error, screenshot console

### Code Snapshot Evidence (4 screenshots)

7. **code/app.js-console-logging-pattern.png**
   - What: VS Code showing lines 78, 106, 175 (error handlers with console.log)
   - Proves: Multiple instances of raw error logging
   - How: Open app.js, select those lines, screenshot

8. **code/verifyToken.js-token-logging.png**
   - What: VS Code showing line 17 (//console.log(token))
   - Proves: Token logging exists (even if commented)
   - How: Open verifyToken.js, select line 17, screenshot

9. **code/users.js-sensitive-logging.png**
   - What: VS Code showing lines 131, 143, 154 (error and token logging)
   - Proves: Multiple sensitive logging instances in users.js
   - How: Open users.js, select those lines, screenshot

10. **code/app.js-enumeration-errors.png**
    - What: VS Code showing lines 272, 282, 359, 409 (enumeration errors)
    - Proves: Different error messages enable enumeration
    - How: Open app.js, select those lines, screenshot

---

## Step-by-Step Capture Process

### Phase 1: Setup (5 minutes)
```bash
# Create screenshot directory
mkdir -p /Users/nr/Developer/turbo-funicular/Assignment/Assets/Nachiketh/code

# Start backend server (Terminal 1)
cd /Users/nr/Developer/turbo-funicular/Assignment/BackEndServer
npm start
# You should see: Running on http://localhost:8081
```

### Phase 2: Backend Console Screenshots (10 minutes)

**Screenshot 1 & 2: No Logging + SQL Error**
```bash
# In Terminal 2, register a user to show no logging
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{"username":"demo1","email":"demo1@example.com","password":"pass123"}'

# Take screenshot of backend console (Terminal 1) showing no audit entry
# Save as: 08-backend-console-no-logging.png

# Then trigger a SQL error by missing required field
curl -X POST http://localhost:8081/game \
  -H "Content-Type: application/json" \
  -d '{"title":""}'

# Take screenshot of backend console showing SQL error details
# Save as: 09-console-sql-error-exposed.png
```

### Phase 3: Enumeration Attack Screenshots (10 minutes)

```bash
# Screenshot 3: Username enumeration
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{"username":"demo1","email":"different@example.com","password":"pass123"}'
# Capture response showing "username already exists"
# Save as: 10-enumeration-username-exists.png

# Screenshot 4: Email enumeration  
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{"username":"demo2","email":"demo1@example.com","password":"pass123"}'
# Capture response showing "email already exists"
# Save as: 11-enumeration-email-exists.png

# Screenshot 5: Contrast with new user
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"newuser@example.com","password":"pass123"}'
# Capture response (different from enumeration errors)
# Save as: 12-enumeration-username-contrast.png
```

### Phase 4: Frontend Console Screenshots (5 minutes)

```bash
# In browser, open http://localhost:3000/admin.html
# Press F12 to open Developer Tools
# Go to Console tab
# Perform action that triggers error
# Screenshot console output showing console.error()
# Save as: 13-frontend-console-error.png
```

### Phase 5: Code Snapshots (10 minutes)

1. Open VS Code
2. Open `Assignment/BackEndServer/controller/app.js`
3. Show lines 78, 106, 175 (or similar error logging lines)
4. Screenshot → Save as `code/app.js-console-logging-pattern.png`

5. Open `Assignment/BackEndServer/auth/verifyToken.js`
6. Show line 17 (token logging)
7. Screenshot → Save as `code/verifyToken.js-token-logging.png`

8. Open `Assignment/BackEndServer/model/users.js`
9. Show lines 131, 143, 154
10. Screenshot → Save as `code/users.js-sensitive-logging.png`

11. Open `Assignment/BackEndServer/controller/app.js`
12. Show lines 272, 282, 359, 409 (enumeration errors)
13. Screenshot → Save as `code/app.js-enumeration-errors.png`

---

## Final File Structure

After capturing all screenshots, you should have:

```
Assignment/Assets/Nachiketh/
├── 08-backend-console-no-logging.png
├── 09-console-sql-error-exposed.png
├── 10-enumeration-username-exists.png
├── 11-enumeration-email-exists.png
├── 12-enumeration-username-contrast.png
├── 13-frontend-console-error.png
└── code/
    ├── app.js-console-logging-pattern.png
    ├── verifyToken.js-token-logging.png
    ├── users.js-sensitive-logging.png
    └── app.js-enumeration-errors.png
```

---

## Documentation Ready

✅ **A09-scoping-and-findings.md** — Complete issue inventory  
✅ **A09-screenshot-capture-guide.md** — Detailed step-by-step guide  
✅ **A09-READY-FOR-SCREENSHOTS.md** — This file (quick reference)  

---

## Next: After Screenshots Are Collected

Once all 10 screenshots are captured, we will:

1. **Write the A09 Report** (2 findings with 7-point structure each)
2. **Document All Issues** in the report with screenshot evidence
3. **Plan Fixes** (structured logging setup)
4. **Implement Fixes** (code changes)
5. **Verify Fixes** (testing)

---

## Current Status

- ✅ Issues identified in codebase
- ✅ Scope documented  
- ✅ Findings planned (2 findings)
- ✅ Screenshot guide created
- ⏳ **NEXT: Capture screenshots** (No code changes yet!)
- ⏳ Write report
- ⏳ Implement fixes
- ⏳ Test fixes

---

**Ready to start capturing screenshots? Use the guide in `A09-screenshot-capture-guide.md`!**
