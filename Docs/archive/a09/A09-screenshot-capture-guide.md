# A09 Screenshot Capture Guide

Follow this step-by-step guide to capture evidence of all A09 vulnerabilities. You'll need the backend server running and a tool like Bruno or curl.

---

## Setup (Do This First)

### 1. Start the Backend Server

```bash
cd /Users/nr/Developer/turbo-funicular/Assignment/BackEndServer
npm start
```

**Expected output:**
```
Running on http://localhost:8081
```

**Keep this terminal open** and watch the console output for error logs as you perform actions.

### 2. Open a Second Terminal for API Testing

```bash
# You can use Bruno, curl, or Postman — examples below use curl
```

### 3. Create the Screenshot Directory

```bash
mkdir -p /Users/nr/Developer/turbo-funicular/Assignment/Assets/Nachiketh
mkdir -p /Users/nr/Developer/turbo-funicular/Assignment/Assets/Nachiketh/code
```

---

## Screenshot 1: Backend Console with No Audit Logging

**File Name:** `08-backend-console-no-logging.png`

**Steps:**
1. Backend server is running in terminal
2. In a second terminal, register a new user:
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser123","email":"test@example.com","password":"testpass123"}'
   ```
3. Look at the backend terminal console
4. You should see:
   - NO log entry for "User registered" 
   - NO timestamp
   - NO user ID
   - Only the response goes back to the API caller
5. **Take a screenshot of the backend console** showing the lack of logging
6. Save as `08-backend-console-no-logging.png`

**What to show in screenshot:**
- Backend server running
- Console is mostly empty or only shows startup messages
- No audit trail of the registration action
- Include timestamp to show when action occurred

---

## Screenshot 2: Error Response Exposes SQL Details

**File Name:** `09-console-sql-error-exposed.png`

**Steps:**
1. Backend server still running
2. In second terminal, trigger a SQL error by making a malformed request:
   ```bash
   curl -X POST http://localhost:8081/game \
     -H "Content-Type: application/json" \
     -d '{"title":"","game_description":"test"}'  # Missing required field
   ```
3. Look at the backend terminal console
4. You should see a SQL error with details about table structure
5. **Take a screenshot of the backend console** showing the raw error
6. Save as `09-console-sql-error-exposed.png`

**What to show in screenshot:**
- Raw SQL error output
- Table/column names visible
- Query structure exposed
- Full error stack trace if present

---

## Screenshot 3: Username Enumeration - Existing User

**File Name:** `10-enumeration-username-exists.png`

**Steps:**
1. Backend server running
2. Register a test user first (if not already done):
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","email":"alice@example.com","password":"password123"}'
   ```
3. Try to register with the same username but different email:
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"alice","email":"alicenew@example.com","password":"password123"}'
   ```
4. Capture the response showing:
   ```
   {"Message":"The username provided already exists."}
   ```
5. **Take a screenshot** of the response (use Bruno or your terminal)
6. Save as `10-enumeration-username-exists.png`

**What to show in screenshot:**
- HTTP POST request to /users
- Response body showing exact message: "The username provided already exists."
- This proves usernames can be enumerated

---

## Screenshot 4: Email Enumeration - Existing User

**File Name:** `11-enumeration-email-exists.png`

**Steps:**
1. Same setup as Screenshot 3
2. Register a test user if not done:
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"bob","email":"bob@example.com","password":"password123"}'
   ```
3. Try to register with different username but same email:
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"bob2","email":"bob@example.com","password":"password123"}'
   ```
4. Capture the response showing:
   ```
   {"Message":"The email provided already exists."}
   ```
5. **Take a screenshot** of the response
6. Save as `11-enumeration-email-exists.png`

**What to show in screenshot:**
- HTTP POST request to /users with existing email
- Response body showing exact message: "The email provided already exists."
- This proves emails can be enumerated

---

## Screenshot 5: Enumeration Contrast - Non-Existing User

**File Name:** `12-enumeration-username-contrast.png`

**Steps:**
1. Backend running
2. Try to register with completely new username and email:
   ```bash
   curl -X POST http://localhost:8081/users \
     -H "Content-Type: application/json" \
     -d '{"username":"newuser999","email":"newuser@example.com","password":"password123"}'
   ```
3. Capture the response (should be different from "already exists" messages)
4. **Take a screenshot** showing the successful registration or different error
5. Save as `12-enumeration-username-contrast.png`

**What to show in screenshot:**
- Contrast between "user already exists" error (enumeration success) and success/different error (enumeration failure)
- Demonstrates attackers can tell which accounts exist

---

## Screenshot 6: Frontend Browser Console Error

**File Name:** `13-frontend-console-error.png`

**Steps:**
1. Open browser to `http://localhost:3000` (or wherever frontend is running)
   - If frontend not running, you may need to start it: `cd FrontEndServer && npm start`
2. Open Developer Tools: Press **F12**
3. Go to **Console** tab
4. Click on "Admin" link or navigate to admin.html
5. Perform an action that might cause an error (try to access something unauthorized)
6. Look for **console.error()** output in the console
7. **Take a screenshot** of the browser console showing error messages
8. Save as `13-frontend-console-error.png`

**What to show in screenshot:**
- Browser Developer Tools Console tab
- console.error() output visible
- Any sensitive error information logged
- Timestamp showing when error occurred

**Alternative (if no error naturally occurs):**
- Open admin.html without being logged in as admin
- Trigger error in network request
- Observe console.error in browser developer tools

---

## Screenshot 7-9: Code Snapshots - Backend Logging

**File Names:**
- `code/app.js-console-logging-pattern.png`
- `code/verifyToken.js-token-logging.png`
- `code/users.js-sensitive-logging.png`
- `code/app.js-enumeration-errors.png`

**Steps for Each:**
1. Open file in VS Code
2. Navigate to the specified lines
3. Select the relevant code block
4. Take screenshot: **Cmd+Shift+4** (macOS) or **Shift+Windows+S** (Windows)
5. Save with the appropriate filename

**Code Snapshots to Capture:**

### app.js - Error Logging Pattern (Lines 78, 106, 175)
```javascript
// Line 78 (GET /users error handler)
if (err) {
    console.log(err);  // <-- Raw error object logged
    res.status(500);
    res.send(`{"Message":"Internal Server Error"}`);
}
```
**File:** `code/app.js-console-logging-pattern.png`

### verifyToken.js - Token Logging (Line 17)
```javascript
// Line 17
//console.log(token);  // <-- Token logging (commented out but demonstrates it was there)
```
**File:** `code/verifyToken.js-token-logging.png`

### users.js - Sensitive Logging (Lines 131, 143, 154)
```javascript
// Line 131
if (err) {
    console.log(err);  // <-- Error logging
}

// Line 143
console.log("Err: " + err);  // <-- Error with prefix

// Line 154
//console.log("@@token " + token);  // <-- Token logging (commented)
```
**File:** `code/users.js-sensitive-logging.png`

### app.js - Enumeration Error Messages (Lines 272, 282, 359, 409)
```javascript
// Line 272
res.send(`{"Message":"The username provided already exists."}`);

// Line 282
res.send(`{"Message":"The email provided already exists."}`);

// Line 359
res.send(`{"Message":"The category name provided already exists."}`);

// Line 409
res.send(`{"Message":"The platform name provided already exists."}`);
```
**File:** `code/app.js-enumeration-errors.png`

---

## Quick Command Reference

### Using curl (Fast Testing)

**Register a user:**
```bash
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"test@example.com",
    "password":"testpass"
  }'
```

**Try duplicate username:**
```bash
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "email":"different@example.com",
    "password":"testpass"
  }'
```

**Try duplicate email:**
```bash
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser2",
    "email":"test@example.com",
    "password":"testpass"
  }'
```

### Using Bruno (if preferred)
1. Open Bruno
2. Load the API collection from `API-Testing/` 
3. Each endpoint is pre-configured
4. Send requests and capture responses

---

## Screenshot Organization

After capturing all screenshots, organize them:

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

## Checklist

- [ ] Screenshot 1: Backend console (no logging)
- [ ] Screenshot 2: SQL error exposed
- [ ] Screenshot 3: Username enumeration
- [ ] Screenshot 4: Email enumeration
- [ ] Screenshot 5: Enumeration contrast
- [ ] Screenshot 6: Frontend console error
- [ ] Screenshot 7: app.js error logging
- [ ] Screenshot 8: verifyToken.js token logging
- [ ] Screenshot 9: users.js sensitive logging
- [ ] Screenshot 10: app.js enumeration errors
- [ ] All files organized in `Assignment/Assets/Nachiketh/`
- [ ] All filenames match exactly

---

## Tips for Better Screenshots

1. **Use High Quality:** Don't compress screenshots too much
2. **Include Context:** Show the URL/endpoint being tested
3. **Show Details:** Make error messages/code clearly readable
4. **Be Consistent:** Use similar zoom level (usually 100% is good)
5. **Terminal/Console:** Capture full width to show all information
6. **Code:** Include line numbers visible in VS Code

---

## Troubleshooting

**Backend server not starting:**
```bash
# Make sure you're in the right directory
cd Assignment/BackEndServer
# Install dependencies if needed
npm install
# Then start
npm start
```

**Frontend not running:**
```bash
cd Assignment/FrontEndServer
npm install
npm start
# Frontend typically runs on http://localhost:3000
```

**Port 8081 already in use:**
```bash
# Kill the process using port 8081
lsof -ti:8081 | xargs kill -9
# Then restart backend
npm start
```

**curl not available:**
- Use Bruno API Client instead (GUI based)
- Or use Postman
- Or use browser's Network tab to capture requests/responses
