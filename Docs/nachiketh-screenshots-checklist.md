# Screenshot Collection Checklist for A01/A09 Report

This checklist tracks which screenshots need to be captured and organized in `Assignment/Assets/Nachiketh/`.

## Finding 1 — Missing Authentication & Authorisation

- [ ] **01-APITesting.png** — Bruno API Client showing endpoints without Authorization headers
- [ ] **11-Brunocancreate an account ad admon.png** — POST /users creating admin account without auth
- [ ] **12-Anyonecandeletegames.png** — DELETE /game/14 succeeding without auth
- [ ] **10 - Insecure Browser tools.png** — Browser Dev Tools removing CSS locked class from admin.html
- [ ] **code/controller_app.js-_216-241.png** — GET /users vulnerable code
- [ ] **code/controller_app.js-_244-302.png** — POST /users vulnerable code
- [ ] **code/controller_app.js-_305-331.png** — GET /users/:userid vulnerable code
- [ ] **code/controller_app.js-_334-381.png** — POST /category vulnerable code
- [ ] **code/controller_app.js-_384-429.png** — POST /platform vulnerable code
- [ ] **code/controller_app.js-_432-495.png** — POST /game vulnerable code
- [ ] **code/controller_app.js-_526-551.png** — DELETE /game/:id vulnerable code
- [ ] **code/controller_app.js-_554-582.png** — POST review vulnerable code
- [ ] **code/controller_app.js-_123-153.png** — Login error leakage code

## Finding 2 — User Data Exposure with Plaintext Passwords

- [ ] **02 - ExposedUsersOnPort8001.png** — GET /users response showing full user list
- [ ] **03 - PasswordsUnhashed.png** — Plaintext passwords visible in response
- [ ] **04 - LogInasAlex.png** — POST /users/login using exposed credentials
- [ ] **05 - ExposedPassword.png** — Alex's password exposed and confirmed working
- [ ] **code/model/user.js :28.png** — getUserSql query selecting password column

## Finding 3 — SQL Injection in Database Queries

- [ ] **code/model/game.js :291-322.png** — updateGame vulnerable code (missing closing quote)
- [ ] **code/model/user.js :100-116.png** — getUserByUserid vulnerable code (${userid} injection)
- [ ] **code/model/game.js :144-176.png** — insertGame vulnerable code (multiple ${} fields)

## Finding 4 — Hardcoded JWT Signing Secret

- [ ] **code/model/config.js.png** — config.js showing hardcoded 'Assignment2key' secret

## Finding 5 — Logging Failures & Information Leakage

- [ ] **08-Consolecoammnd.png** — Server console output (or lack thereof) during operations
- [ ] **14-SQL Injection.png** — SQL error revealing database structure
- [ ] **13-Exposure.png** — POST review impersonation (15-Impersonate-Review-POST.yml result)
- [ ] **code/model/verify.js.png** — verifyToken.js logging headers and token

---

## How to Capture Screenshots

### For API Testing (Bruno/Postman/curl):
1. Open Bruno API Client and load `API-Testing/opencollection.yml`
2. Send each request and capture the request/response pair
3. Save as PNG with descriptive filename

### For Code Snapshots:
1. Open file in VS Code
2. Select the relevant lines
3. Take screenshot (Cmd+Shift+4 on macOS, Shift+Windows+S on Windows)
4. Or use VS Code extension like "Polacode" to export code snippets

### For Browser Testing:
1. Open admin.html in browser
2. Open Developer Tools (F12)
3. Inspect elements and show CSS `locked` class
4. Screenshot showing removal of class to bypass access control

### For Server Console:
1. Start backend server
2. Perform actions (create user, delete game, etc.)
3. Screenshot console output showing minimal logging
4. Trigger errors and screenshot console showing SQL errors

---

## Verification

After collecting all screenshots:
1. Create directory: `mkdir -p Assignment/Assets/Nachiketh/code`
2. Move all images to `Assignment/Assets/Nachiketh/`
3. Verify all image filenames match exactly as referenced in `nachikethreport.md`
4. Test markdown rendering to confirm all image links work

---

## Notes

- Image filenames should match EXACTLY as written in the report (case-sensitive)
- Use PNG format for clarity
- Ensure screenshots are readable and clearly show the vulnerability
- For code snippets, include the file path and line numbers in the image or caption
