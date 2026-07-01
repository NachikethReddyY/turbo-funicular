# Cognito Migration — Code Changes Reference

This document lists every code change made to wire **AWS Cognito** into SP Games, what each change does, and what to **screenshot** for your report or presentation.

Primary commit: `ee4e21f` (`aws edits`).  
Deploy docs: `Docs/cognito-migration-steps.md`.

---

## Architecture before vs after

```text
BEFORE (local auth)
  Browser → POST /users/login (email + password) → backend signs JWT with JWT_SECRET
         → frontend stores token → API calls use Bearer token

AFTER (Cognito)
  Browser → Cognito Hosted UI (PKCE) → cognito-callback.html exchanges code for tokens
         → frontend stores Cognito access token → API calls use Bearer token
         → backend verifies token against Cognito JWKS (not JWT_SECRET for Cognito tokens)
```

---

## 1. New file: `Assignment/FrontEndServer/Public/js/cognito-auth.js`

**Status:** New file (236 lines).  
**Why:** Central module for all Cognito browser auth. Replaces inline login forms and local password handling.

### Lines 1–10 — `COGNITO_CONFIG`

```javascript
const COGNITO_CONFIG = Object.freeze({
  region: "us-east-1",
  userPoolId: "us-east-1_Nn98cdkS9",
  clientId: "78ub41p21tn42ahgeo4frrhc42",
  domain: "https://us-east-1nn98cdks9.auth.us-east-1.amazoncognito.com",
  redirectPath: "/cognito-callback.html",
  postLoginPath: "/newHome.html",
  postLogoutPath: "/newHome.html",
  scopes: ["openid", "email", "profile"]
});
```

| Field | Purpose |
|-------|---------|
| `clientId`, `userPoolId`, `domain` | Public SPA identifiers — safe in frontend JS |
| `redirectPath` | OAuth callback page on **same origin** (localhost, Amplify, etc.) |
| `scopes` | Must match Cognito app client OIDC scopes (`profile` required) |

**Screenshot:** VS Code open on lines 1–10. Cognito console → App client showing same client ID.

---

### Lines 12–19 — `STORAGE_KEYS`

Maps Cognito tokens to the same `localStorage` key names the old app used (`Token`, etc.) so existing pages keep working.

**Why:** Minimal churn — pages already read `localStorage.getItem('Token')` or use `getAccessToken()`.

---

### Lines 23–33 — Dynamic redirect URIs

```javascript
function getRedirectUri() {
  return getAbsoluteUrl(COGNITO_CONFIG.redirectPath);
}
```

Builds callback URL from `window.location.origin` + `/cognito-callback.html`.

**Why:** Same code works on `localhost:3001`, S3 HTTP, and `https://staging.d17j0oh1yf13ch.amplifyapp.com` without hardcoding the host. Cognito must register each origin’s callback URL.

**Screenshot:** Browser DevTools → Network → `/oauth2/authorize` request → `redirect_uri` query param.

---

### Lines 53–65 — PKCE (`createCodeChallenge`)

Generates `code_verifier` and SHA-256 `code_challenge` (S256).

**Why:** Public browser clients must use PKCE so stolen authorization codes cannot be exchanged without the verifier. AWS recommended pattern for SPAs.

**Screenshot:** Same authorize URL showing `code_challenge_method=S256` and `code_challenge=...`.

---

### Lines 107–127 — `exchangeCodeForTokens`

POST to `{domain}/oauth2/token` with `grant_type=authorization_code`, `code`, `code_verifier`, `redirect_uri`.

**Why:** Completes OAuth code flow after Cognito redirects back. No client secret in the request (public client).

---

### Lines 94–105 — `buildUserProfile`

Reads **ID token** claims: `sub`, email, `cognito:groups`. Maps `Admin` group → `type: "Admin"`.

**Why:** Frontend UI can show user info and admin state before calling `/CheckRole`.

---

### Lines 156–175 — `signIn()`

Redirects browser to `{domain}/oauth2/authorize` with PKCE + `state` (CSRF protection).

**Why:** Replaces `POST /users/login` with Cognito Hosted UI.

---

### Lines 177–207 — `completeSignIn()`

1. Validates `state` matches `sessionStorage`
2. Exchanges `code` for tokens
3. Stores `access_token`, `id_token`, `refresh_token`, user profile in `localStorage`

**Why:** Called from `cognito-callback.html` after Cognito redirect.

**Screenshot:** `cognito-callback.html` → “Signed in. Redirecting...” then `newHome.html`.

---

### Lines 209–217 — `signOut()`

Clears storage and redirects to Cognito `/logout` with `logout_uri`.

**Why:** Ends Cognito session, not just local storage.

---

### Lines 220–236 — `wireLogoutLinks`, `updateAuthLinks`

Hook navbar Login/Logout visibility to auth state.

---

## 2. New file: `Assignment/FrontEndServer/Public/cognito-callback.html`

**Status:** New file (35 lines).  
**Why:** OAuth redirect target. Cognito sends `?code=...&state=...` here.

| Lines | What |
|-------|------|
| 19–32 | Imports `completeSignIn()`, shows status, redirects to `newHome.html` on success |

**Screenshot:** Page mid-sign-in (“Completing sign in”) and browser URL bar showing `.../cognito-callback.html?code=...`.

---

## 3. `Assignment/FrontEndServer/Public/login.html`

**Status:** Heavily simplified (~165 lines removed).

### Before
- Email/password form
- POST to backend `/users/login`
- “Remember Me” stored credentials client-side (A07 vulnerability)

### After (key lines)

| Lines | Change |
|-------|--------|
| 31–32 | Copy: “Sign in with Cognito” |
| 34 | Button `Continue to Cognito` |
| 42–45 | `import { signIn } from "./js/cognito-auth.js"` |

**Why:** Password never touches your app. Cognito handles credentials.

**Screenshot:** Side-by-side or before/after: old login form vs new Cognito button. Live: `https://staging.d17j0oh1yf13ch.amplifyapp.com/login.html`.

---

## 4. `Assignment/FrontEndServer/Public/register.html`

**Status:** Same pattern as login (~199 lines removed).

| Lines | Change |
|-------|--------|
| 31–32 | “Create an account with Cognito” |
| 42–44 | `signUp` button calls `signIn()` → Cognito Hosted UI (user clicks “Create an account” there) |

**Why:** Registration removed from local backend; Cognito user pool handles sign-up.

**Screenshot:** Register page + Cognito Hosted UI “Create an account” link.

---

## 5. `Assignment/BackEndServer/auth/verifyToken.js`

**Status:** Rewritten (~32 lines → 142 lines).

### Before (`ee4e21f^`)
- Only `jwt.verify(token, config.key)` — trusted **app-issued** JWT signed with `JWT_SECRET`

### After — new functions

| Lines | Function | Why |
|-------|----------|-----|
| 8–24 | `getCognitoConfig()` | Reads `COGNITO_*` from `.env`; builds issuer + JWKS URL |
| 26–42 | `fetchJson()` | HTTPS fetch Cognito JWKS endpoint |
| 44–78 | `getSigningKey()` | Cache JWKS 1 hour; resolve RSA public key by `kid` |
| 80–106 | `verifyCognitoToken()` | Verify RS256, issuer, `token_use === 'access'`, `client_id` match; map `cognito:groups` → `req.type` |
| 108–121 | `verifyLegacyToken()` | Fallback if Cognito env vars missing |
| 123–140 | `verifyToken()` | Route to Cognito or legacy verifier |

**Security improvements:**
- Backend trusts **Cognito’s signature**, not your own secret, for login tokens
- Validates token is an **access** token for **your** app client
- Admin role from **Cognito group** `Admin`, not client-controlled JWT claim

**Screenshot:** VS Code `verifyToken.js` lines 80–104. Postman/browser: `GET /CheckRole` with `Authorization: Bearer <cognito_access_token>` → `{ "role": "Admin" }`.

---

## 6. `Assignment/BackEndServer/controller/app.js`

### Lines 126–134 — `POST /users/login` blocked

**Before:** Accepted email/password, called `userDB.loginUser()`, returned app JWT.

**After:**
```javascript
res.status(410);
res.json({
  success: false,
  message: 'Local password login has been replaced by AWS Cognito hosted login.'
});
```

**Why:** Forces all login through Cognito; closes A07 local password path.

**Screenshot:** Bruno/Postman POST `/users/login` → 410 response body.

---

### Lines 137–142 — `POST /users/logout` updated

Returns message to use Cognito hosted logout from frontend instead of clearing `rememberMe` cookie.

---

## 7. `Assignment/BackEndServer/.env.example`

**Added lines 7–10:**

```env
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_Nn98cdkS9
COGNITO_CLIENT_ID=78ub41p21tn42ahgeo4frrhc42
COGNITO_ADMIN_GROUP=Admin
```

**Why:** Backend needs pool ID and client ID to verify tokens. `COGNITO_ADMIN_GROUP` names which Cognito group maps to admin.

**Screenshot:** EC2 `~/BackEndServer/.env` with Cognito vars (blur `DB_PASSWORD` / `JWT_SECRET`).

---

## 8. `Assignment/FrontEndServer/.env.example`

Cognito-related env vars for local frontend server (reference; `cognito-auth.js` currently hardcodes public values).

---

## 9. Protected HTML pages — token source change

These pages were updated to import from `cognito-auth.js` and send **Cognito access token** to the API.

| File | Script change |
|------|----------------|
| `index.html` | L64–76: `getAccessToken`, `updateAuthLinks`, `wireLogoutLinks`, `/CheckRole` |
| `newHome.html` | Same pattern |
| `admin.html` | L85–99: `getAccessToken`, `/CheckRole` admin gate |
| `addNewCategory.html` | `getAccessToken` on POST |
| `addNewGame.html` | `getAccessToken` on POST |
| `addNewPlatform.html` | `getAccessToken` on POST |
| `gamesSearch.html` | `getAccessToken` on search |
| `newGame-Detail.html` | `getAccessToken` on review POST |

**Typical pattern (e.g. `admin.html` lines 85–93):**
```javascript
import { getAccessToken, getCurrentUser, wireLogoutLinks } from "./js/cognito-auth.js";
const token = getAccessToken();
fetch(apiBase + '/CheckRole', { headers: { 'Authorization': 'Bearer ' + token } });
```

**Before:** Token came from `localStorage` after `POST /users/login`.  
**After:** Token is Cognito **access_token** from PKCE flow.

**Screenshot:** DevTools → Application → Local Storage → `Token`, `user`. Network tab → API call with `Authorization: Bearer eyJ...`.

---

## 10. Documentation and ops (non-runtime)

| File | Purpose |
|------|---------|
| `Docs/cognito-migration-steps.md` | Deploy order, EC2 env, CloudFront/Amplify, CSV import |
| `Docs/cognito-users-import.csv` | SQL users → Cognito bulk import |
| `scripts/export-cognito-users-csv.sh` | Regenerate CSV from MySQL |
| `Assignment/FrontEndServer/tests/cognito-auth.spec.js` | Playwright: login page, PKCE redirect, callback error |
| `.teach/aws-assignment/lessons/cognito-s3-ec2-security.html` | Teaching lesson on public vs secret |

---

## AWS console configuration (not in repo code)

Required for code to work in production:

| Setting | Your value |
|---------|------------|
| User pool ID | `us-east-1_Nn98cdkS9` |
| App client | SP Games / `78ub41p21tn42ahgeo4frrhc42` |
| Callback URLs | `https://staging.d17j0oh1yf13ch.amplifyapp.com/cognito-callback.html`, `http://localhost:3001/cognito-callback.html` |
| Sign-out URLs | `https://staging.d17j0oh1yf13ch.amplifyapp.com/newHome.html`, `http://localhost:3001/newHome.html` |
| OAuth grant | Authorization code grant |
| Scopes | `openid`, `email`, `profile` |
| Admin group | `Admin` — add John/Tim after CSV import |

**Screenshot checklist (AWS):**
1. User pool overview (pool ID visible)
2. App client → Login pages → callback/sign-out URLs
3. Hosted UI login page
4. Groups → `Admin` group with members
5. S3 bucket static website + Amplify HTTPS URL
6. Optional: Import users job succeeded

---

## Screenshot checklist (code)

| # | What to capture | File / location |
|---|-----------------|-----------------|
| 1 | Cognito config constants | `cognito-auth.js` L1–10 |
| 2 | PKCE sign-in redirect | `cognito-auth.js` L156–175 |
| 3 | Token verification | `verifyToken.js` L80–104 |
| 4 | Legacy login blocked | `app.js` L126–134 |
| 5 | New login UI | `login.html` L31–45 |
| 6 | OAuth callback handler | `cognito-callback.html` L19–32 |
| 7 | API uses Cognito token | `admin.html` L85–93 or Network tab |
| 8 | Backend env | `.env.example` or EC2 `.env` (secrets redacted) |
| 9 | End-to-end login | Amplify login → Cognito → home logged in |
| 10 | Role check works | `/CheckRole` response or admin tab visible |

---

## Known gaps (mention in report)

1. **API base URL** still `http://54.196.133.103:8081` in HTML — mixed content on HTTPS Amplify.
2. **User IDs** — Cognito `sub` (string) vs MySQL `userid` (int) for reviews.
3. **Secrets Manager** — documented, not wired in code yet.
4. **S3 HTTP** — hosting evidence; Cognito callbacks use **Amplify HTTPS**.

---

## One-paragraph report summary

> Authentication was migrated from local email/password login to AWS Cognito Hosted UI with PKCE. The frontend module `cognito-auth.js` handles authorization-code exchange and token storage; `login.html` and `register.html` no longer collect passwords. The backend `verifyToken.js` verifies Cognito access tokens via JWKS and maps the `Admin` group to application roles; `POST /users/login` returns HTTP 410. Static frontend is hosted on S3; HTTPS and Cognito callbacks use AWS Amplify at `https://staging.d17j0oh1yf13ch.amplifyapp.com`.
