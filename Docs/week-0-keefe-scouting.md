# Week 0 Scouting Findings – A07 Identification & Authentication Failures

---

**Title:** A07 – Identification & Authentication Failures Initial Scouting Report

**Written by:** Keefe Chen

**Collaborators:** Team Members (Nachiketh, Mike, Sitt)

**Reviewed by:** 

**Date:** 08-Jun-2026

---

# 1. Owner

- **Name:** Keefe Chen
- **GitHub Username:** Keefeinfotech
- **Assigned OWASP Category:** A07 – Identification & Authentication Failures
- **Date:** 08-Jun-2026

---

# 2. Scope I Scouted

The objective of this scouting phase was to understand how authentication and user credential management were implemented throughout the application.

| Area | File / URL / Endpoint | Why it matters |
|------|----------------------|----------------|
| Backend Authentication Logic | `model/users.js` | Handles user registration and login processes |
| Authentication Middleware | `auth/verifyToken.js` | Verifies JWT tokens and protects endpoints |
| Configuration Files | `config/config.js` | Stores JWT secret keys and authentication settings |
| Database | MySQL Workbench (`users` table) | Stores user account information and passwords |
| Login Flow | Login API endpoints | Processes user authentication requests |
| Registration Flow | Registration API endpoints | Creates new user accounts |

---

# 3. Potential Vulnerabilities Found

| Candidate Flaw | OWASP Category | Evidence Location | Detailed or Brief | Confidence |
|----------------|---------------|-------------------|-------------------|------------|
| Plaintext Password Storage | A07 | `model/users.js`, `users` table | Detailed | High |
| Hardcoded JWT Secret Key | A07 | `config/config.js` | Detailed | High |
| Weak Authentication Configuration | A07 | Authentication flow | Brief | Medium |
| Missing Password Hashing | A07 | Registration Logic | Detailed | High |

---

# 4. Exploit Scout Notes

## Finding 1 – Plaintext Password Storage

### Preconditions

- Attacker gains database access through another vulnerability or insider access.

### Test Account / Role Needed

- None.

### Request or Page Used

- User registration and login functionality.

### Expected Impact

- User passwords can be immediately viewed if the database is compromised.
- Credential reuse attacks become possible.
- User accounts may be compromised on other platforms.
- Significant violation of authentication security best practices.

### Safe Test Demonstration

1. Register a test account through the application.
2. Access the database using MySQL Workbench.
3. Verify whether the submitted password appears in plaintext within the `users` table.
4. Document findings with screenshots for evidence.

---

## Finding 2 – Hardcoded JWT Secret Key

### Preconditions

- Attacker obtains access to source code, deployment files, backups, or leaked repositories.

### Test Account / Role Needed

- None.

### Request or Page Used

- JWT authentication process.

### Expected Impact

- Attacker may forge valid authentication tokens.
- Authentication bypass becomes possible.
- Potential privilege escalation to higher-level accounts.
- Compromised integrity of the authentication system.

### Safe Test Demonstration

1. Review source code for hardcoded secrets.
2. Verify whether JWT signing keys are stored directly in code.
3. Confirm whether environment variables are being used.
4. Document evidence and recommend secure secret management.

---

# 5. Code Evidence

## Finding 1 – Plaintext Password Storage

**File:** `model/users.js`

**Observation:**  
User passwords are inserted directly into the database without hashing.

```javascript
// Example structure
INSERT INTO users(username, password)
VALUES (?, ?)
```

## 6. Fix Direction

- Recommended approach: Implement secure password handling by hashing all user passwords before storage using a strong hashing algorithm such as bcrypt. Ensure that plaintext passwords are never stored or logged. Additionally, enforce proper authentication validation during login by comparing hashed values instead of raw strings.
- Code area to change: `Assignment/BackEndServer/model/users.js` (registration + login functions), and any authentication-related controller routes that handle user credential processing
- Libraries/middleware needed: bcrypt (for hashing passwords), optional dotenv (for secure configuration of authentication secrets)
- Possible side effects: Existing user accounts stored in plaintext will need to be migrated or reset since hashed passwords cannot be directly compared with existing values

---

## 7. Tools and Methods Used

- Tool/method: Manual code review + database inspection
- What I tested: User registration flow, login validation logic, and database storage of credentials
- Result: Confirmed that passwords are stored in plaintext and authentication logic does not apply hashing or secure comparison

---

## 8. What I Want To Do Next

Turn scouting into Week 1 action items.

- [x] Review authentication flow in `users.js`
- [x] Verify database credential storage
- [x] Identify missing password hashing mechanism
- [ ] Capture screenshots of plaintext password storage
- [ ] Create proof-of-concept login with exposed credentials
- [ ] Implement bcrypt hashing fix in registration flow
- [ ] Update login validation logic to compare hashed passwords
- [ ] Test authentication after fix implementation

---

## 9. Questions / Blockers

- Need confirmation on whether existing user accounts should be migrated or reset after implementing bcrypt hashing
- Need team agreement on password policy (minimum length / complexity requirements)
