# A01/A09 Fixes Implementation Tracker

Track which recommended fixes have been implemented in the codebase.

## Finding 1: Missing Authentication & Authorisation

### Required Fixes

- [ ] **Create `auth/requireAdmin.js` middleware** (NEW FILE)
  - [ ] Checks `req.type === 'admin'`
  - [ ] Returns 403 with `{"auth": false, "message": "Admin access required!"}`
  - [ ] Calls `next()` on success
  - **Location:** `Assignment/BackEndServer/auth/requireAdmin.js`

- [ ] **Update `controller/app.js` — Import requireAdmin**
  - [ ] Add: `var requireAdmin = require('../auth/requireAdmin.js');` (around line 15)
  - **Location:** Line 15

- [ ] **Update `GET /users` endpoint (line 219)**
  - [ ] Add middleware: `app.get('/users', verifyToken, requireAdmin, function...`
  - [ ] Original: `app.get('/users', function`

- [ ] **Update `POST /users` endpoint (line 244)**
  - [ ] Add middleware: `app.post('/users', verifyToken, requireAdmin, function...`
  - [ ] Change: `var type = 'user';` (hardcode, never trust client)
  - [ ] Remove: Client-supplied `type` from `req.body`

- [ ] **Update `GET /users/:userid` endpoint (line 305)**
  - [ ] Add middleware: `app.get('/users/:userid', verifyToken, requireAdmin, function...`

- [ ] **Update `POST /category` endpoint (line 334)**
  - [ ] Add middleware: `app.post('/category', verifyToken, requireAdmin, function...`

- [ ] **Update `POST /platform` endpoint (line 384)**
  - [ ] Add middleware: `app.post('/platform', verifyToken, requireAdmin, function...`

- [ ] **Update `POST /game` endpoint (line 432)**
  - [ ] Add middleware: `app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function...`
  - [ ] Note: `requireAdmin` must come BEFORE `upload.single()`

- [ ] **Update `DELETE /game/:id` endpoint (line 526)**
  - [ ] Add middleware: `app.delete('/game/:id', verifyToken, requireAdmin, function...`

- [ ] **Update `POST /users/:uid/game/:gid/review` endpoint (line 554)**
  - [ ] Add middleware: `app.post('/users/:uid/game/:gid/review', verifyToken, function...`
  - [ ] Add validation: Check `req.userid == req.params.uid` before allowing review post
  - [ ] Note: Only `verifyToken` required, not `requireAdmin` (any authenticated user can post reviews)

- [ ] **Update Login error handler (line 123–153)**
  - [ ] Replace: `res.send(err.statusCode);`
  - [ ] With: `res.json({ success: false, message: 'Login failed' });`
  - [ ] Remove: `console.log(result);` that logs user object with password

## Finding 2: User Data Exposure with Plaintext Passwords

### Required Fixes

- [ ] **Update `model/users.js` — Remove password from SELECT (line 28)**
  - [ ] Old: `select userid, username, email, password, type, profile_pic_url, ...`
  - [ ] New: `select userid, username, email, type, profile_pic_url, ...`
  - **Location:** `Assignment/BackEndServer/model/users.js` line 28

- [ ] **`GET /users` already has `verifyToken, requireAdmin`** (from Finding 1 fixes)

### Future Work (Out of Scope for This Report)

- [ ] Hash passwords with bcrypt before storage (`bcrypt.hash()` in insertUser)
- [ ] Verify passwords with bcrypt during login (`bcrypt.compare()` in loginUser)

## Finding 3: SQL Injection in Database Queries

### Required Fixes

- [ ] **Update `model/users.js` — `getUserByUserid` (lines 100–103)**
  - [ ] Old: `` `select ... FROM users where userid = ${userid};` ``
  - [ ] New: `` `select ... FROM users where userid = ?;` ``
  - [ ] Change: `dbConn.query(getUserByUserIDSql, [], function...`
  - [ ] To: `dbConn.query(getUserByUserIDSql, [userid], function...`
  - [ ] Also remove `password` from SELECT (see Finding 2)
  - **Location:** `Assignment/BackEndServer/model/users.js` lines 100–116

- [ ] **Update `model/game.js` — `insertGame` (lines 157–160)**
  - [ ] Old: `` `INSERT INTO game (...) VALUES ('${title}', '${game_description}', '${year}', ?);` ``
  - [ ] New: `` `INSERT INTO game (...) VALUES (?, ?, ?, ?);` ``
  - [ ] Change: `dbConn.query(insertGameSql, [game_image.buffer], function...`
  - [ ] To: `dbConn.query(insertGameSql, [title, game_description, year, game_image.buffer], function...`
  - **Location:** `Assignment/BackEndServer/model/game.js` lines 157–176

- [ ] **Update `model/game.js` — `updateGame` (lines 303–306)**
  - [ ] Old: `` `update game set title='${title}', ... where gameID='${gameID}` `` (missing closing quote!)
  - [ ] New: `` `UPDATE game SET title=?, game_description=?, year=?, game_image=? WHERE gameID=?;` ``
  - [ ] Change: `dbConn.query(updateGameSql, [], function...`
  - [ ] To: `dbConn.query(updateGameSql, [title, game_description, year, game_image.buffer, gameID], function...`
  - **Location:** `Assignment/BackEndServer/model/game.js` lines 303–322

## Finding 4: Hardcoded JWT Signing Secret

### Required Fixes

- [ ] **Update `config.js` — Load secret from environment variable**
  - [ ] Old: `var secret='Assignment2key'; //your own secret key`
  - [ ] New:
    ```javascript
    var secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('FATAL: JWT_SECRET environment variable is not set.');
        process.exit(1);
    }
    ```
  - **Location:** `Assignment/BackEndServer/config.js`

- [ ] **Add `JWT_SECRET` to `.env` file**
  - [ ] Add: `JWT_SECRET=<strong-random-secret>` 
  - [ ] Example: `JWT_SECRET=super_secret_key_change_in_production_12345`
  - **Location:** `Assignment/BackEndServer/.env`

## Finding 5: Logging Failures & Information Leakage

### Required Fixes

- [ ] **Update `auth/verifyToken.js` — Remove sensitive logging (lines 5–9)**
  - [ ] Remove: `console.log(req.headers);`
  - [ ] Remove: `console.log(token);`
  - **Location:** `Assignment/BackEndServer/auth/verifyToken.js` lines 5–9

- [ ] **Update `model/users.js` — Comment out token logging (line 153)**
  - [ ] Change: `console.log("@@token " + token);`
  - [ ] To: `// console.log("@@token " + token);`
  - **Location:** `Assignment/BackEndServer/model/users.js` line 153

- [ ] **Update all `console.log(err)` in error handlers**
  - [ ] Option 1 (Quick fix): Comment out all `console.log(err)` statements
  - [ ] Option 2 (Better): Replace with structured logging (Winston/Morgan) — see below
  - [ ] Count in `controller/app.js`: ~22 instances
  - [ ] Count in `model/users.js`: Several instances
  - [ ] Count in `model/game.js`: Several instances
  - **Location:** Multiple files

### Future Work (Out of Scope for This Report)

- [ ] Integrate Winston or Morgan for structured logging
- [ ] Log security events: authentication attempts, data modifications, access denials
- [ ] Implement account lockout after N failed login attempts
- [ ] Persist logs to rotating files or central logging service
- [ ] Add HSTS headers and HTTPS enforcement
- [ ] Implement rate limiting on login endpoint

---

## Testing Checklist

After implementing all fixes, verify with these tests:

### Test 1: Authentication Enforcement

- [ ] `GET /users` without token → 403 Forbidden
- [ ] `GET /users` with non-admin token → 403 Forbidden
- [ ] `GET /users` with admin token → 200 OK (no password field)
- [ ] `POST /game` without token → 403 Forbidden
- [ ] `DELETE /game/1` without token → 403 Forbidden

### Test 2: Password Removal

- [ ] `GET /users` response does NOT include `password` field
- [ ] `GET /users/:userid` response does NOT include `password` field

### Test 3: SQL Injection Prevention

- [ ] `GET /users/1 OR 1=1` returns nothing (not all users)
- [ ] `POST /game` with `title='; DROP TABLE game; --` creates game with literal title
- [ ] No SQL errors appear in console

### Test 4: JWT Secret

- [ ] Server fails to start if `JWT_SECRET` is not in `.env`
- [ ] Server starts successfully when `JWT_SECRET` is set
- [ ] Forged token with old secret 'Assignment2key' is rejected (403 Forbidden)

### Test 5: Logging

- [ ] Server console does NOT print request headers
- [ ] Server console does NOT print raw JWT tokens
- [ ] `console.log(err)` does NOT appear for errors (or is minimized)
- [ ] No information leakage in error responses

---

## Summary

**Total Fixes Required:** ~15 file edits + 1 new file creation

**Critical Path:** Findings 1, 2, 3 must be fixed before any user data is accessible.

**Deadline:** All fixes should be implemented before final report submission.
