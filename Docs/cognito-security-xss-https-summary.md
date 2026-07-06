# Cognito, HTTPS, Cookies, Rate Limiting, Profile, and XSS Fix Summary

## Overview

This document explains the security/authentication changes made for the Game Shop application in `Assignment/FrontEndServer` and `Assignment/BackEndServer`.

## Cognito authentication

The app now uses AWS Cognito Hosted UI for login and registration instead of local username/password forms.

Configured Cognito values:

- User pool ID: `us-east-1_Nn98cdkS9`
- Region: `us-east-1`
- App client ID: `78ub41p21tn42ahgeo4frrhc42`
- Hosted UI domain: `https://us-east-1nn98cdks9.auth.us-east-1.amazoncognito.com`
- Callback URL: `https://localhost:3001/cognito-callback.html`
- Logout URL: `https://localhost:3001/newHome.html`
- Scopes: `email openid phone profile`

Frontend Cognito logic is handled in:

```text
Assignment/FrontEndServer/Public/js/cognito-auth.js
```

The login and register pages now redirect to Cognito:

```text
Assignment/FrontEndServer/Public/login.html
Assignment/FrontEndServer/Public/register.html
```

The callback handler exchanges the authorization code for tokens and stores the returned tokens/user profile in local storage:

```text
Assignment/FrontEndServer/Public/cognito-callback.html
```

## Backend token verification

Backend protected routes use Cognito JWT verification through:

```text
Assignment/BackEndServer/auth/verifyToken.js
```

The backend validates Cognito access tokens with the Cognito issuer and JWKS endpoint. Legacy JWT support remains as a fallback when Cognito environment variables are not configured.

## HTTPS setup

Both frontend and backend run over HTTPS locally:

```text
Frontend: https://localhost:3001
Backend:  https://localhost:443
```

Frontend HTTPS server:

```text
Assignment/FrontEndServer/server.js
```

Backend HTTPS server:

```text
Assignment/BackEndServer/server.js
```

Localhost certificates are stored in each server's `certs` folder. If Chrome reports `ERR_CERT_AUTHORITY_INVALID`, the local development CA/certificate must be trusted in the macOS keychain or regenerated with a trusted local CA.

## CORS

The backend allows the frontend origin with credentials enabled:

```text
https://localhost:3001
```

This is configured in:

```text
Assignment/BackEndServer/server.js
Assignment/BackEndServer/controller/app.js
```

## Cookies

The legacy `rememberMeToken` cookie was hardened with secure cookie options:

```js
httpOnly: true
secure: true
sameSite: 'lax'
```

This prevents JavaScript access to the cookie and restricts cross-site sending.

## Rate limiting

Rate limiting is enabled with `express-rate-limit` in:

```text
Assignment/BackEndServer/controller/app.js
```

Current limiter:

- Window: 15 minutes
- Max attempts: 5
- Applied to login and registration endpoints

```text
POST /users/login
POST /users
```

## Database configuration

The database connection was changed from hardcoded MySQL credentials to environment variables:

```text
Assignment/BackEndServer/model/databaseConfig.js
```

It now reads:

```env
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
```

This fixed the `Access denied for user 'root'@'localhost'` issue caused by stale hardcoded credentials.

## Cognito users and local numeric user IDs

Cognito user IDs are UUID/string subjects, but the existing `review.fk_users` database column expects a numeric local `users.userid`.

To bridge this:

- When a Cognito user needs to submit a review, the backend finds or creates a matching local user row.
- The review is inserted using the numeric local user ID.

Implemented in:

```text
Assignment/BackEndServer/model/users.js
Assignment/BackEndServer/controller/app.js
```

## Profile completion

A profile completion page was added for Cognito users:

```text
Assignment/FrontEndServer/Public/complete-profile.html
```

It lets users choose a display username and upload a JPEG profile image.

To prevent large payload errors:

- Backend JSON/body parser limit was raised to `25mb`.
- Frontend resizes JPEG uploads to a max dimension of 512px before upload.
- Frontend rejects files larger than 5 MB before sending.

Profile utilities live in:

```text
Assignment/FrontEndServer/Public/js/profile-utils.js
```

## XSS fixes

The XSS issue was caused by untrusted data being rendered with `innerHTML`.

Unsafe rendering was replaced with safe DOM APIs:

- `textContent`
- `replaceChildren()`
- `document.createElement()`
- `new Option()`

Fixed pages:

```text
Assignment/FrontEndServer/Public/newGame-Detail.html
Assignment/FrontEndServer/Public/gamesSearch.html
```

Review input is now also validated on both frontend and backend. Payloads such as:

```html
<img src="" onerror="alert('XSS')">
```

are rejected with:

```text
Invalid review input
```

Backend validation rejects review content that:

- is empty
- is over 1000 characters
- contains `<` or `>`
- has a rating outside `1` to `5`

## Playwright XSS test

A Playwright test was added to verify that XSS payloads do not execute:

```text
Assignment/FrontEndServer/tests/xss.spec.js
Assignment/FrontEndServer/playwright.xss.config.js
```

Run it with:

```bash
cd Assignment/FrontEndServer
npx playwright test tests/xss.spec.js --config=playwright.xss.config.js
```

Expected result:

```text
1 passed
```

The test injects XSS payloads into mocked game/review API responses and confirms no browser alert is executed.

## Node 26 compatibility patch

Node 26 removed/changed `SlowBuffer` behavior used by the old `buffer-equal-constant-time` dependency. This caused:

```text
TypeError: Cannot read properties of undefined (reading 'prototype')
```

A prestart patch was added:

```text
Assignment/BackEndServer/scripts/patch-node26.js
```

And wired into:

```text
Assignment/BackEndServer/package.json
```

So `bun start` patches the dependency before starting the backend.

## How to run

Backend:

```bash
cd Assignment/BackEndServer
bun start
```

Frontend:

```bash
cd Assignment/FrontEndServer
bun start
```

Open:

```text
https://localhost:3001/login.html
```

## Required Cognito console settings

In the Cognito app client, ensure these exact values are configured:

```text
Allowed callback URL:
https://localhost:3001/cognito-callback.html

Allowed sign-out URL:
https://localhost:3001/newHome.html

OAuth grant:
Authorization code grant

Scopes:
email
openid
phone
profile
```
