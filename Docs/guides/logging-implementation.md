# Logging And Cognito Review Fix Documentation

This document explains the logging work completed for the assignment backend, the files changed, how the review/comment testing was done, and the separate Cognito fix needed for review submission.

## Summary

The project originally had weak logging for security events. Errors were commonly written with raw `console.log(err)`, which could expose database details such as SQL error codes, table names, column names, and internal stack information. Security-sensitive actions were also not consistently recorded in a structured way.

We added centralized logging using Winston and a small wrapper module. The backend now records audit events and safe error messages in JSON format, both in the terminal and in a persistent log file.

The final backend logging path is:

```text
controller/model code
    -> Assignment/BackEndServer/securityLog.js
        -> Assignment/BackEndServer/logger.js
            -> terminal output
            -> Assignment/BackEndServer/logs/combined.log
```

## Files Changed For Logging

| File | Purpose |
|------|---------|
| `Assignment/BackEndServer/package.json` | Added the `winston` dependency |
| `Assignment/BackEndServer/bun.lock` / package lock | Updated dependency lock data after installing Winston |
| `Assignment/BackEndServer/logger.js` | Creates the Winston logger, JSON formatter, console transport, and file transport |
| `Assignment/BackEndServer/securityLog.js` | Exposes `audit()` and `safeError()` helper functions used by the backend |
| `Assignment/BackEndServer/controller/app.js` | Replaced raw error logging with `safeError()` and added `audit()` events |
| `Assignment/BackEndServer/model/users.js` | Uses `safeError()` in user-related error paths |

## Winston Logger

The Winston setup lives in:

```text
Assignment/BackEndServer/logger.js
```

It does three important things:

1. Creates the log folder automatically:

```js
const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });
```

2. Formats logs as JSON:

```js
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(function (info) {
        return JSON.stringify({
            ts: info.timestamp,
            level: info.level,
            message: info.message,
            action: info.action,
            detail: info.detail || {},
            stack: info.stack
        });
    })
);
```

3. Sends logs to both terminal and file:

```js
new winston.transports.Console({ format: logFormat })

new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    level: 'info',
    format: logFormat
})
```

The persistent log file is:

```text
Assignment/BackEndServer/logs/combined.log
```

## Logging Helper Module

The backend does not call Winston directly from every route. Instead, routes call:

```text
Assignment/BackEndServer/securityLog.js
```

This file exports two helper functions:

```js
module.exports = { audit: audit, safeError: safeError };
```

`audit(action, detail)` records security-relevant activity.

Example:

```js
audit('review_created', { userid: appUserid, gameID: gameID, reviewid: results.insertId });
```

`safeError(err)` records only a safe error message instead of dumping the entire raw error object.

Example:

```js
safeError(err);
```

## Log Output Format

A successful audit log looks like:

```json
{"ts":"2026-06-29 15:28:51","level":"info","message":"audit","action":"review_created","detail":{"userid":9,"gameID":"1","reviewid":14}}
```

An error log looks like:

```json
{"ts":"2026-06-29 15:25:28","level":"error","message":"Incorrect integer value: '...' for column 'fk_users' at row 1","detail":{}}
```

Earlier testing produced some `undefined` lines in `combined.log` because the first Winston file transport did not have a final JSON formatter. This was fixed in `logger.js`. Old `undefined` lines may remain in the existing log file, but new log entries now write valid JSON.

## Audit Events Added

The backend now records audit logs for important security-sensitive actions.

| Event | Meaning |
|-------|---------|
| `legacy_login_blocked` | A request hit the old local login endpoint after login was replaced by Cognito |
| `logout` | A logout request was made |
| `user_registered` | A user was created, including auto-created Cognito-linked local profiles |
| `category_created` | An admin created a category |
| `platform_created` | An admin created a platform |
| `game_created` | An admin created a game |
| `game_deleted` | An admin deleted a game |
| `review_denied` | A user attempted to post a review as another user |
| `review_created` | A review was successfully created |

## Error Logging Changes

Before the fix, many handlers used raw logging:

```js
console.log(err);
```

This was a problem because raw database errors can expose implementation details.

After the fix, routes use:

```js
safeError(err);
```

The API response remains generic:

```js
res.status(500);
res.type("json");
res.send(`{"Message":"Internal Server Error"}`);
```

This means developers still get a log entry, but users do not receive raw database details.

## Duplicate Error Message Change

Duplicate database errors previously risked revealing whether a username, email, category, or platform already existed.

The backend now uses one generic duplicate message:

```js
var DUPLICATE_MSG = '{"Message":"The requested resource already exists."}';
```

This reduces enumeration risk because the response no longer tells an attacker exactly which field already exists.

## Review/Comment Testing

The review/comment flow was used to test both logging and error handling.

### Test 1: Submit Review With Cognito User

Steps:

1. Start backend:

```bash
bun start
```

2. Open the frontend on:

```text
http://localhost:3001
```

3. Log in through Cognito.

4. Open a game detail page.

5. Submit a review/comment.

Expected result:

- The frontend shows a success message.
- The review appears under the game.
- The backend writes a `review_created` audit log.
- `Assignment/BackEndServer/logs/combined.log` receives a JSON log line.

Example expected log:

```json
{"ts":"...","level":"info","message":"audit","action":"review_created","detail":{"userid":9,"gameID":"1","reviewid":14}}
```

### Test 2: Attempt Review Impersonation

The route is:

```text
POST /users/:uid/game/:gid/review
```

The backend checks whether the authenticated token user matches the `:uid` path parameter.

If a user tries to post as another user, the backend records:

```js
audit('review_denied', { actor: req.userid, target: userid, gameID: gameID });
```

Expected result:

- The request returns HTTP `403`.
- The review is not inserted.
- The backend writes a `review_denied` audit log.

### Test 3: Confirm Log File Output

After submitting a review, inspect:

```text
Assignment/BackEndServer/logs/combined.log
```

Expected current output:

```json
{"ts":"...","level":"info","message":"audit","action":"review_created","detail":{...}}
```

If old `undefined` lines are visible, they are from the earlier formatter issue. New entries after restarting the backend should be JSON.

## Separate Cognito Review Fix

The logging work exposed a separate bug in the review flow after Cognito login was added.

### Problem

Cognito identifies users by a UUID-like `sub`, for example:

```text
f498d4f8-b0c1-7015-52a2-45d580e59b4f
```

However, the existing local database schema stores reviews with an integer foreign key:

```text
review.fk_users -> users.userid
```

When the frontend submitted a review using the Cognito `sub`, MySQL rejected it:

```text
Incorrect integer value: 'f498d4f8-b0c1-7015-52a2-45d580e59b4f' for column 'fk_users'
```

### Files Changed For Cognito Fix

| File | Purpose |
|------|---------|
| `Assignment/BackEndServer/auth/verifyToken.js` | Stores Cognito `sub`, email, username, and groups on the request |
| `Assignment/BackEndServer/model/users.js` | Adds `getUserByEmail()` and `insertCognitoUser()` |
| `Assignment/BackEndServer/controller/app.js` | Resolves Cognito users to local numeric `userid` before inserting reviews |
| `Assignment/BackEndServer/model/review.js` | Returns user email with reviews so the frontend can display a better name |
| `Assignment/FrontEndServer/Public/newGame-Detail.html` | Sends user email with review submission and displays a readable reviewer name |

### Backend Fix

In `verifyToken.js`, the backend now keeps Cognito fields:

```js
req.userid = decoded.sub;
req.cognitoSub = decoded.sub;
req.cognitoEmail = decoded.email;
req.cognitoUsername = decoded.username;
```

In `users.js`, the backend can find a local user by email:

```js
getUserByEmail(email, callback)
```

If no local user exists, the backend creates one:

```js
insertCognitoUser(username, email, type, callback)
```

In `app.js`, the review route now converts the Cognito user into a local integer `userid` before inserting into `review.fk_users`.

### Auto-Created Local User

If a Cognito user does not already exist in the local `users` table, the backend creates a minimal local profile.

The generated username uses the email prefix and part of the Cognito ID:

```text
emailprefix_f498d4f8
```

This avoids using the full Cognito UUID as the displayed name and reduces duplicate username conflicts.

Local password login is disabled, so the auto-created local user uses a placeholder password:

```text
COGNITO_LOGIN_DISABLED
```

### Frontend Display Fix

Some existing reviews had already been created with a Cognito UUID-like username. To avoid showing this ugly value in the UI, `newGame-Detail.html` now uses a display helper.

If the username looks like a Cognito ID, the frontend displays the email prefix instead.

Example:

```text
Before: f498d4f8-b0c1-7015-52a2-45d580e59b4f_f498d4f8
After:  user email prefix
```

## Final Result

After these changes:

- Backend logging uses Winston.
- Logs are structured JSON.
- Logs are written to both terminal and `logs/combined.log`.
- Raw `console.log(err)` patterns were replaced with safer logging.
- Security-relevant actions produce audit logs.
- Review creation is logged with `review_created`.
- Review impersonation attempts are logged with `review_denied`.
- Cognito users can submit reviews without breaking the integer foreign key constraint.
- Reviewer names display in a readable way instead of showing Cognito UUIDs.
