# A09 Visual Summary — What We're Looking For

## What is A09? (OWASP Top 10 2021)

**Security Logging & Monitoring Failures** = The application fails to log, monitor, and respond to security events.

### The Problem in Simple Terms

```
User registers → No log entry ❌
User logs in → No log entry ❌
Admin deletes data → No log entry ❌
Hacker brute-forces login → No detection ❌
Data breach happens → No audit trail to investigate ❌
```

**Result:** Security team is blind. Can't detect attacks. Can't investigate breaches.

---

## Two Types of A09 Issues We Found

### Type 1: Missing Audit Logging (CRITICAL)

```
What should happen:
  [User Action] → [Server] → Log Entry: "2024-06-14 10:30:45 User:5 Action:LOGIN Status:SUCCESS IP:192.168.1.1"

What actually happens:
  [User Action] → [Server] → [Console] (nothing useful logged)
```

**Impact:** 
- Can't detect brute-force attacks
- Can't investigate "who deleted the data"
- Violates compliance requirements

---

### Type 2: Information Leakage via Logging (HIGH)

#### Sub-Type 2A: Sensitive Data in Console Logs

```
What should happen:
  [Error occurs] → [Logged safely to file] → [Generic error to user]

What actually happens:
  [Error occurs] → [console.log(err)] → Raw SQL error visible in stdout
  
Example leakage:
  SELECT userid, username, email, password FROM users WHERE id=1
  └─ Exposes: Table name, column names, database structure
```

#### Sub-Type 2B: Enumeration via Error Messages

```
Attack: Try to register username "alice"

Response A: {"Message":"The username provided already exists."}
└─ Attacker learns: "alice" is a registered account

Response B: {"Message":"The email provided already exists."}  
└─ Attacker learns: This email is in the system

Attacker Action: Try 10,000 common usernames
Result: Builds list of all valid accounts → Enables targeted attacks
```

---

## Real Examples From This Application

### Problem 1: No Logging During Login
```javascript
// Current code in controller/app.js (lines 82-115)
app.post('/users/login', function (req, res) {
    // ... database query ...
    if (passwordMatch) {
        // ✅ Login succeeds
        // ❌ BUT NO LOG ENTRY for successful login
    } else {
        // ❌ Login fails
        // ❌ AND NO LOG ENTRY for failed login attempt
    }
});

Result: 
  10 failed login attempts → Zero indication of brute-force attack
```

### Problem 2: console.log(err) Everywhere
```javascript
// Current code in controller/app.js (appears 25 times!)
if (err) {
    console.log(err);  // ❌ Logs entire error object with SQL details
    res.status(500);
    res.send(some_message);
}

Sample output to console:
  Error: ER_DUP_ENTRY: Duplicate entry 'alice' for key 'users.username'
  └─ Exposes: Table name is "users", unique constraint on "username"
```

### Problem 3: Enumeration Errors
```javascript
// Current code in controller/app.js (lines 272, 282)
if (usernameExists) {
    res.send(`{"Message":"The username provided already exists."}`);
    // ❌ Tells attacker: This username is registered
}

if (emailExists) {
    res.send(`{"Message":"The email provided already exists."}`);
    // ❌ Tells attacker: This email is registered
}

Attacker exploit:
  for each username in [top_1000_usernames]:
      try to register username
      if response == "already exists":
          add to valid_accounts_list
  
  Result: Attacker now has list of valid accounts
```

### Problem 4: Token Logging (Even When Commented)
```javascript
// Current code in auth/verifyToken.js (line 17)
//console.log(token);  // ❌ Commented out but shows it was there

Danger: If someone has access to server logs:
  console output contains: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  └─ That's a real JWT token → Can be used to impersonate user
```

### Problem 5: Frontend Errors in Console
```javascript
// Current code in login.html, admin.html, etc.
}catch(e){ 
    console.error(e);  // ❌ Logs error details to browser console
}

Risk: If error message contains sensitive info, it's now in browser console
      and could be shared, captured, or logged by browser extensions
```

---

## Evidence We'll Capture

### Visual Evidence 1: Empty Console During User Registration
```
Terminal Output (Backend Server):
─────────────────────────────────
Running on http://localhost:8081
[API Call] POST /users (registration)
[Response] 201 Created
[Log Entry] ❌ NOTHING - No audit trail
```

**What this proves:** No logging for user registration

---

### Visual Evidence 2: SQL Error Details in Console
```
Terminal Output (Backend Server):
─────────────────────────────────
[API Call] POST /game (with invalid data)
[Error output]
Error: ER_NO_DEFAULT_FOR_FIELD: Field 'title' doesn't have a default value
  └─ Exposes: Database uses MySQL, exact column names, validation rules
```

**What this proves:** Sensitive SQL errors logged to console

---

### Visual Evidence 3: Username Enumeration Attack
```
API Call 1: POST /users
Body: {"username":"alice","email":"test1@example.com",...}
Response: {"Message":"The username provided already exists."}
└─ Proves "alice" is registered

API Call 2: POST /users  
Body: {"username":"bob","email":"test2@example.com",...}
Response: {"Message":"The username provided already exists."}
└─ Proves "bob" is registered

API Call 3: POST /users
Body: {"username":"hacker123","email":"test3@example.com",...}
Response: {"Message":"Registration successful"} or error (but different message)
└─ Proves "hacker123" is NOT registered
```

**What this proves:** Attacker can enumerate which usernames exist

---

### Visual Evidence 4: Email Enumeration Attack
```
API Call 1: POST /users
Body: {"username":"test1","email":"alice@company.com",...}
Response: {"Message":"The email provided already exists."}
└─ Proves alice@company.com is in the system

API Call 2: POST /users
Body: {"username":"test2","email":"bob@company.com",...}
Response: {"Message":"The email provided already exists."}
└─ Proves bob@company.com is in the system

Attacker builds: [alice@company.com, bob@company.com, ...] 
Now can do: Targeted phishing, password reset attacks, etc.
```

**What this proves:** Attacker can enumerate which emails exist

---

### Visual Evidence 5: Frontend Console Errors
```
Browser Console (F12 Developer Tools):
─────────────────────────────────────
[Error] TypeError: Cannot read property 'type' of undefined
  at Object.check (admin.html:95)

Attacker sees: Application uses 'type' property (probably user role)
               Uses JavaScript for checking (client-side)
               Error messages reveal code structure
```

**What this proves:** Errors logged to client console expose information

---

### Visual Evidence 6-10: Code Snapshots

```
app.js line 78:
    if (err) {
        console.log(err);  ← Raw error object
        res.status(500);
    }
    
This pattern repeats 25 times → 25 instances of error leakage

verifyToken.js line 17:
    //console.log(token);  ← Token logging (commented but shows intent)
    
users.js lines 131, 143:
    console.log(err);  ← Error logging
    console.log("Err: " + err);  ← More error logging
    
app.js lines 272, 282, 359, 409:
    res.send(`{"Message":"The username provided already exists."}`);  ← Enumeration
    res.send(`{"Message":"The email provided already exists."}`);   ← Enumeration
```

**What this proves:** Systematic issues across multiple files

---

## Impact Summary

| Issue | Risk | Example |
|-------|------|---------|
| **No audit logging** | Breach undetected | Attacker deletes all games, no log entry |
| **console.log(err)** | System info leak | SQL error reveals database structure |
| **Token logging** | Session hijacking | Logged JWT could be stolen from logs |
| **Enumeration errors** | Account discovery | Attacker builds list of valid usernames |
| **Frontend console errors** | Info disclosure | Users see internal error details |

---

## Security Impact in Simple Terms

```
┌─────────────────────────────────────────────────────────┐
│  Attacker's Perspective                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Zero logging → I can attack without being detected │
│                                                         │
│  2. SQL errors → I learn database structure            │
│                                                         │
│  3. Enumeration errors → I build list of valid users   │
│                                                         │
│  4. No audit trail → Company can't investigate me      │
│                                                         │
│  Result: PERFECT CONDITIONS FOR A SUCCESSFUL ATTACK    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## What Success Looks Like (After We Fix It)

```
User Registration:
  [User Action] → [Server] → Log Entry: "2024-06-14 10:30:45 User registration successful: newuser IP:192.168.1.1"
  
Failed Login Attempt:
  [User Action] → [Server] → Log Entry: "2024-06-14 10:31:12 Failed login attempt: alice (3/5) IP:192.168.1.1"
  [After 5 failures] → Alert: "Account locked for security"
  
Admin Action:
  [User Action] → [Server] → Log Entry: "2024-06-14 10:32:00 Admin:5 deleted Game:42 IP:192.168.1.1"
  
Security Team View:
  ✅ Can see all actions with timestamps
  ✅ Can detect brute-force attacks in progress
  ✅ Can investigate breaches with full audit trail
  ✅ Can meet compliance requirements
  ✅ No sensitive data in logs
  ✅ No information leakage in error messages
```

---

## Next Step

👉 **Start capturing screenshots using the guide in `A09-screenshot-capture-guide.md`**

The screenshots will serve as evidence of all these issues. Once captured, we'll write the A09 report with the same 7-point structure as A01.
