---
author: Mike Franco Abat
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report - OWASP A03 Injection

This report covers SQL Injection issues in the turbo-funicular assignment app. The backend exposes Express routes that pass request data into MySQL queries through the model layer. The findings below focus on unsafe string interpolation in `getUserByUserid` and `insertGame`, plus the unused but still vulnerable `updateGame` helper.

---

## Finding 1 - SQL Injection in `GET /users/:userid`

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

The route reads `userid` from the URL and passes it into `model/users.js` without parameterization. The model then inserts that value directly into a SQL string, which allows attacker-controlled SQL syntax to become part of the query.

### 2. Exploitation

An attacker can send a request such as:

```http
GET /users/1 OR 1 = 1
```

The backend responds with user data instead of only the intended record, because the injected condition changes the `WHERE` clause.

Relevant screenshots:

![GET /users/:userid proof of concept request](../Assets/Mike/get-users-poc.png)

![GET /users/:userid vulnerable code](../Assets/Mike/get-users-code.png)

### 3. Database Storage

The affected data is stored in the `users` table. Relevant columns include `userid`, `username`, `email`, `password`, `type`, `profile_pic_url`, and `created_at`. The `password` field is returned directly by the query, so the endpoint exposes sensitive data in plaintext form to any caller who can reach it.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/controller/app.js`

```javascript
app.get('/users/:userid', function (req, res) {
    var userid = req.params.userid;
    userDB.getUserByUserid(userid, function (err, results) {
        ...
    });
});
```

**File:** `Assignment/BackEndServer/model/users.js`

```javascript
var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;
```

### 5. Recommendations & Fix Code

Replace the string interpolation with a parameterized query and avoid returning the password unless it is absolutely required.

**File:** `Assignment/BackEndServer/model/users.js`

```javascript
var getUserByUserIDSql = `
    SELECT userid, username, email, type, profile_pic_url,
           DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
    FROM users
    WHERE userid = ?;
`;

dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
    ...
});
```

### 6. Testing Process

- Before fix: send `GET /users/1 OR 1 = 1`
- After fix: the same input should be treated as a literal value or rejected by validation

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Found the vulnerable query construction |
| Bruno / API request tool | Sent the proof-of-concept request |

---

## Finding 2 - SQL Injection in `POST /game`

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

The `POST /game` route accepts form data and forwards it to `insertGame`. The model creates an `INSERT` statement using string interpolation for `title`, `game_description`, and `year`, which allows the SQL structure to be altered by crafted input.

### 2. Exploitation

An attacker can submit a request to `POST /game` with a crafted `title` or `description` value that contains a quote or SQL syntax. The query breaks or changes meaning, leading to a server error or data corruption.

Relevant screenshots:

![POST /game proof of concept request](../Assets/Mike/insertgame-request.png)

![POST /game server error response](../Assets/Mike/insertgame-error.png)

![POST /game vulnerable code](../Assets/Mike/insertgame-code.png)

### 3. Database Storage

The affected data is stored in the `game` table, with related rows also inserted into `game_platform` and `game_category`. The vulnerable write path affects the main `game` insert, which stores title, description, year, and image data.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/controller/app.js`

```javascript
app.post('/game', upload.single('game_image'), function (req, res) {
    var title = req.body.title;
    var game_description = req.body.description;
    var year = req.body.year;
    var game_image = req.file;

    gameDB.insertGame(title, game_description, year, game_image, function (err, results) {
        ...
    });
});
```

**File:** `Assignment/BackEndServer/model/game.js`

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

### 5. Recommendations & Fix Code

Use placeholders for all values and keep the image buffer bound as a parameter.

**File:** `Assignment/BackEndServer/model/game.js`

```javascript
var insertGameSql = `
    INSERT INTO game (title, game_description, year, game_image)
    VALUES (?, ?, ?, ?)
`;

dbConn.query(insertGameSql, [title, game_description, year, game_image.buffer], function (err, results) {
    ...
});
```

### 6. Testing Process

- Before fix: send a `POST /game` request with a quoted or SQL-like `title`
- After fix: the same input should not alter the query structure

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Found the interpolated SQL query |
| Bruno / API request tool | Captured the failing insert request |

---

## Finding 3 - SQL Injection in `updateGame()`

### 1. Vulnerability & Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

The `updateGame()` helper in `model/game.js` builds an `UPDATE` statement by concatenating user-controlled values directly into SQL. I did not find a direct route calling it in the controller, but the helper is still unsafe and would become exploitable if a route starts using it.

### 2. Exploitation

This helper is not currently reached by a public route in `app.js`, so there is no live HTTP proof-of-concept for it in the app flow. The risk comes from the query construction itself: if any route forwards raw input into this helper, the SQL can be altered the same way as the other findings.

### 3. Database Storage

The affected data is stored in the `game` table, including the title, description, year, image, and the `gameID` primary key used in the `WHERE` clause.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/model/game.js`

```javascript
var updateGameSql = `update game set title='${title}', game_description='${game_description}', year='${year}', game_image='${game_image.buffer}' where gameID='${gameID}`;
```

### 5. Recommendations & Fix Code

Use placeholders for every value, including the `gameID` in the `WHERE` clause.

**File:** `Assignment/BackEndServer/model/game.js`

```javascript
var updateGameSql = `
    UPDATE game
    SET title = ?, game_description = ?, year = ?, game_image = ?
    WHERE gameID = ?
`;

dbConn.query(updateGameSql, [title, game_description, year, game_image.buffer, gameID], function (err, results) {
    ...
});
```

### 6. Testing Process

- Before fix: inspect the helper and confirm the SQL string is interpolated
- After fix: the helper should use parameter placeholders only

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Found the unsafe helper |
| Source search | Checked whether any controller route calls the helper directly |

---

## Conclusion

| Finding | Category | Severity |
|---------|----------|----------|
| 1 - SQL Injection in `GET /users/:userid` | A03 | High |
| 2 - SQL Injection in `POST /game` | A03 | High |
| 3 - SQL Injection in `updateGame()` | A03 | High |

The root cause across all findings is unsafe SQL construction with direct string interpolation. The fix is to use parameterized queries, reduce sensitive data exposure, and validate inputs before they reach the model layer.
