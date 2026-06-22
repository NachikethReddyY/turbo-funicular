---
author: Sitt Naing
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report - OWASP A04 Insecure Design

## Executive Summary

This report documents insecure design weaknesses in the SP Games web application, a Node.js and Express backend with a static HTML/CSS/JavaScript frontend and MySQL database. The assessment focuses on **OWASP A04: Insecure Design**, where security controls were missing or placed in the wrong layer during the application design.

Two main design issues were selected:

1. **Frontend-only admin access control** - admin checks were implemented in browser JavaScript, while privileged backend routes originally lacked matching server-side authorization.
2. **Client-controlled role assignment during registration** - the registration flow accepted the account role from the client request, allowing an attacker to tamper the request and self-assign an admin role.

Both findings show the same root cause: the application design trusted the frontend to enforce security decisions. Secure design should place authentication, authorization, role assignment, and validation on the server side.

---

## Assessment Methodology


| Item                | Detail                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Backend             | `Assignment/BackEndServer` - Express API                                                                                 |
| Frontend            | `Assignment/FrontEndServer/Public` - static HTML and JavaScript pages                                                    |
| Auth flow inspected | JWT login, `/CheckRole`, `verifyToken.js`, `requireAdmin.js`                                                             |
| Evidence folder     | `Assets/Sitt/a04/`                                                                                                       |
| Main files reviewed | `controller/app.js`, `auth/verifyToken.js`, `auth/requireAdmin.js`, `register.html`, `addNewCategory.html`, `admin.html` |


The assessment used manual code review and safe proof-of-concept request design. The current repository already contains some server-side fixes, so this report presents the insecure original design, the exploitation path, and the corrected route design now expected for secure implementation.

---

## Finding 1 - Frontend-Only Admin Access Control

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A04 - Insecure Design (client-side-only authorization design)

The application originally treated frontend JavaScript as the main admin access control. Admin pages such as `addNewCategory.html` call `/CheckRole` and block form submission if the user is not an admin. However, this design is insecure because browser checks only protect the UI. They do not protect the backend API.

In a secure design, privileged routes such as creating categories, creating platforms, creating games, and deleting games must enforce authorization on the server. The original design allowed the backend to accept direct requests even if the user never opened the frontend admin page.

Evidence of the frontend-only check:

Frontend-only admin check in addNewCategory.html

Before the fix, the design problem was that admin-equivalent backend routes were public route handlers with no `verifyToken` or `requireAdmin` middleware:

Before-fix admin routes without middleware

The corrected server-side design applies both authentication and admin authorization to the route definitions:

Fixed admin route design with verifyToken and requireAdmin

### 2. Exploitation

An attacker can bypass the browser entirely and send requests directly to the backend API.

**Step 1 - Ignore the admin UI**

The attacker does not need to visit `admin.html` or `addNewCategory.html`. The frontend `checkAdmin()` function cannot run if the attacker uses curl, Postman, Bruno, or another HTTP client.

**Step 2 - Send a direct request to an admin endpoint**

```http
POST /category HTTP/1.1
Host: localhost:8081
Content-Type: application/json

{"catname":"BypassCategory","description":"Created without auth"}
```

Before the server-side fix, the expected vulnerable response would be:

```http
201 Created
{"Message":"Rows affected:1"}
```

The same design issue applied to other privileged operations:

```http
POST /platform
POST /game
DELETE /game/:id
```

Safe proof-of-concept request:

Direct API bypass request example

**What the attacker achieves:**

- Creates categories or platforms without being an admin
- Adds fake game records
- Deletes game records
- Bypasses all frontend admin restrictions

### 3. Database Storage

This vulnerability affects database integrity rather than exposing a single sensitive column.

Affected tables include:


| Table           | Impact                                          |
| --------------- | ----------------------------------------------- |
| `category`      | Unauthorised category creation                  |
| `platform`      | Unauthorised platform creation                  |
| `game`          | Unauthorised game creation or deletion          |
| `game_platform` | Unauthorised game-platform relationship changes |
| `game_category` | Unauthorised game-category relationship changes |


The issue is not how these tables store data. The issue is that the original application design allowed unauthorised users to trigger writes and deletes against them.

### 4. Affected Code (with Location)

**File:** `Assignment/FrontEndServer/Public/addNewCategory.html`

```javascript
async function checkAdmin(){
    const token = localStorage.getItem('Token');
    if(!token){
        showAlert('Admin access required. Please login.', 'warning');
        return false;
    }

    const res = await fetch(apiBase + '/CheckRole', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const d = await res.json();
    return (d.role === 'Admin' || d.role === 'admin');
}
```

This code is useful for user experience, but it is not a complete security control because it runs only inside the browser.

**File:** `Assignment/BackEndServer/controller/app.js`

Before-fix route design:

```javascript
app.post('/category', function (req, res) { ... });
app.post('/platform', function (req, res) { ... });
app.post('/game', upload.single('game_image'), function (req, res) { ... });
app.delete('/game/:id', function (req, res) { ... });
```

Current fixed route design:

```javascript
var verifyToken = require('../auth/verifyToken.js');
var requireAdmin = require('../auth/requireAdmin.js');

app.post('/category', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/platform', verifyToken, requireAdmin, function (req, res) { ... });
app.post('/game', verifyToken, requireAdmin, upload.single('game_image'), function (req, res) { ... });
app.delete('/game/:id', verifyToken, requireAdmin, function (req, res) { ... });
```

**File:** `Assignment/BackEndServer/auth/requireAdmin.js`

```javascript
function requireAdmin(req, res, next) {
    if (String(req.type || '').toLowerCase() !== 'admin') {
        res.status(403);
        return res.json({ auth: false, message: 'Admin access required!' });
    }
    next();
}

module.exports = requireAdmin;
```

### 5. Recommendations & Fix Code

The fix is to design authorization as a backend route requirement, not a frontend page behaviour.

Recommended route pattern:

```javascript
// Server-side middleware chain for privileged routes
app.post('/category', verifyToken, requireAdmin, validateCategoryInput, function (req, res) {
    // create category
});
```

Recommended design rules:

- Keep `checkAdmin()` in the frontend only as a usability feature.
- Require `verifyToken` for every protected API route.
- Require `requireAdmin` for admin-only actions.
- Use a default-deny route design: routes are private unless explicitly public.
- Add server-side schema validation before writing to the database.

### 6. Testing Process


| Test                              | Before fix             | After fix                   |
| --------------------------------- | ---------------------- | --------------------------- |
| `POST /category` with no token    | `201 Created`          | `403 Not authorized`        |
| `POST /platform` with no token    | `201 Created`          | `403 Not authorized`        |
| `POST /game` with no token        | Game created           | `403 Not authorized`        |
| `DELETE /game/:id` with no token  | `204 No Content`       | `403 Not authorized`        |
| Same requests with customer token | Allowed or not checked | `403 Admin access required` |
| Same requests with admin token    | Allowed                | Allowed                     |


Example before-fix test:

```bash
curl -X POST http://localhost:8081/category \
  -H "Content-Type: application/json" \
  -d "{\"catname\":\"BypassCategory\",\"description\":\"Created without auth\"}"
```

Example after-fix test:

```bash
curl -X POST http://localhost:8081/category \
  -H "Content-Type: application/json" \
  -d "{\"catname\":\"BypassCategory\",\"description\":\"Created without auth\"}"
```

Expected after-fix response:

```json
{"auth":"false","message":"Not authorized!"}
```

### 7. Tools Used


| Tool                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| Manual code review         | Trace admin flow from frontend pages to backend routes        |
| curl / HTTP request design | Demonstrate how frontend checks are bypassed                  |
| Browser DevTools           | Inspect client-side role checks and local storage assumptions |
| Cursor IDE                 | Locate code paths and prepare report evidence                 |


---

## Finding 2 - Client-Controlled Role Assignment During Registration

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A04 - Insecure Design (unsafe trust boundary and role assignment design)

The registration flow included a user role field (`type`) in the frontend and sent that value to the backend. The original backend design accepted the role from the request body and inserted it into the database. This is insecure because account role is an authorization decision, and authorization decisions must be controlled by the server.

The frontend only displayed a normal user option, but attackers can edit the request body and send a different role such as `Admin`.

Client-controlled account type during registration

The fixed design assigns the account role server-side instead of trusting client input:

Fixed server-side role assignment

### 2. Exploitation

**Step 1 - Open the registration request**

The normal registration form sends a JSON body containing user details.

**Step 2 - Tamper the JSON body**

Instead of accepting the form's `user` value, the attacker sends:

```http
POST /users HTTP/1.1
Host: localhost:8081
Content-Type: application/json

{
  "username": "attacker_admin",
  "email": "attacker@example.com",
  "password": "password123",
  "type": "Admin",
  "profile_pic_url": "https://example.com/pic.jpg"
}
```

Before the fix, the backend would store `type = "Admin"` because it trusted `req.body.type`.

**What the attacker achieves:**

- Creates an admin account without approval
- Receives a JWT containing admin role claims after login
- Can access admin features if backend role checks depend on the stored `type`

### 3. Database Storage

Affected table: `users`

Relevant columns:


| Column     | Purpose                | Design issue                    |
| ---------- | ---------------------- | ------------------------------- |
| `userid`   | User primary key       | Not the issue                   |
| `username` | Login/display identity | Normal registration input       |
| `email`    | Login identity         | Normal registration input       |
| `password` | Credential             | Overlaps with A07               |
| `type`     | Role / account type    | Should not be client-controlled |


The `type` field is security-sensitive because it controls whether a user is treated as an admin. The design should not expose this field to public registration. It should be set by the server or by a protected admin-only promotion workflow.

### 4. Affected Code (with Location)

**File:** `Assignment/FrontEndServer/Public/register.html`

```javascript
const type = form.type.value;
const payload = { username, email, password, type, profile_pic_url };
```

**File:** `Assignment/BackEndServer/controller/app.js`

Before-fix design:

```javascript
app.post('/users', function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var type = req.body.type;
    var profile_pic_url = req.body.profile_pic_url;

    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) {
        // ...
    });
});
```

Current fixed design:

```javascript
app.post('/users', verifyToken, requireAdmin, function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var type = 'user';
    var profile_pic_url = req.body.profile_pic_url;

    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) {
        // ...
    });
});
```

### 5. Recommendations & Fix Code

The server must own role assignment.

Recommended public registration pattern:

```javascript
app.post('/register', function (req, res) {
    var username = req.body.username;
    var email = req.body.email;
    var password = req.body.password;
    var profile_pic_url = req.body.profile_pic_url;

    // Role is assigned by the server, not received from the client.
    var type = 'Customer';

    userDB.insertUser(username, email, password, type, profile_pic_url, function (err, results) {
        // ...
    });
});
```

Recommended admin user creation pattern:

```javascript
app.post('/users', verifyToken, requireAdmin, function (req, res) {
    // Only an existing admin can create privileged accounts.
});
```

Additional recommendations:

- Remove the `type` input from public registration forms.
- Define a single role enum such as `Customer` and `Admin`.
- Normalize role comparisons with lowercase conversion or constants.
- Audit all code paths that depend on `user.type`.

### 6. Testing Process


| Test                                     | Before fix                        | After fix                       |
| ---------------------------------------- | --------------------------------- | ------------------------------- |
| Register with `"type":"Admin"`           | Admin account created             | Role ignored or request blocked |
| Register with `"type":"user"`            | User account created              | User/customer account created   |
| Register without `type`                  | May fail or insert undefined role | Server assigns default role     |
| Non-admin calls protected `/users` route | Allowed before fix                | `403`                           |


Before-fix proof-of-concept:

```bash
curl -X POST http://localhost:8081/users \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"attacker_admin\",\"email\":\"attacker@example.com\",\"password\":\"password123\",\"type\":\"Admin\"}"
```

After-fix expected result depends on final design:

- If `/users` is admin-only: `403 Not authorized` for unauthenticated users
- If public registration is kept: account is created with `type = "Customer"` or `type = "user"` regardless of request body

### 7. Tools Used


| Tool                | Purpose                                                            |
| ------------------- | ------------------------------------------------------------------ |
| Manual code review  | Trace role field from `register.html` into `app.js` and `users.js` |
| HTTP request design | Show how the client JSON body can be tampered                      |
| MySQL schema review | Confirm `users.type` is the role storage field                     |
| Cursor IDE          | Create report and screenshot evidence                              |


---

## Conclusion


| Finding                                                   | Category            | Severity |
| --------------------------------------------------------- | ------------------- | -------- |
| 1 - Frontend-only admin access control                    | A04 Insecure Design | Critical |
| 2 - Client-controlled role assignment during registration | A04 Insecure Design | High     |


The two findings share the same root cause: the original design trusted the client side to make or enforce security decisions. Admin access and role assignment must be server-side responsibilities.

The current secure direction is to:

- Protect privileged routes with `verifyToken` and `requireAdmin`.
- Assign roles on the server.
- Keep frontend checks only as usability helpers.
- Define a consistent role model.
- Add server-side validation before database writes.

Remaining work should include live curl or Bruno evidence for before/after testing, screenshots of API responses, and final confirmation that all role-dependent flows behave correctly for admin, customer, and unauthenticated users.