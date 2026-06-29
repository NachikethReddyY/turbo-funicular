---
author: Mike Franco Abat
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report - OWASP A03 Injection

## Overview

This report covers SQL Injection and Stored XSS weaknesses in the `Cryptix` game catalogue application. The backend uses Node.js, Express, and MySQL, while the frontend renders game and review data directly into the DOM.

The two required A03 findings are:

- Finding 1: SQL Injection in `GET /users/:userid` - detailed
- Finding 2: Stored XSS via unescaped `innerHTML` in review, game, category, and platform rendering - brief

Two additional injection sinks were also found during source review and are included as supplementary findings:

- Finding 3: SQL Injection in `POST /game`
- Finding 4: SQL Injection in `updateGame()`

The shared root cause across all findings is the same: the application trusts raw user input and embeds it directly into SQL strings or HTML markup instead of treating it as data.

---

## Finding 1 - SQL Injection in `GET /users/:userid` (Detailed)

### 1. Vulnerability and Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

The `userid` path parameter is read from the URL and passed into `userDB.getUserByUserid()` without validation or parameterization. In the model layer, that value is concatenated directly into the SQL `WHERE` clause.

Because the database receives the combined string as raw SQL text, an attacker can alter the query structure by supplying SQL syntax instead of a normal numeric ID. The route is also public, so no authentication token is required to reach it.

### 2. Exploitation

**Step 1 - Normal request:**

```bash
curl "http://localhost:8081/users/1"
```

This should return the record for `userid = 1`.

**Step 2 - Force a SQL error to confirm the sink:**

```bash
curl "http://localhost:8081/users/'"
```

A raw MySQL syntax error indicates the value is being interpreted as SQL rather than data.

**Step 3 - Dump all user records with a tautology:**

```bash
curl "http://localhost:8081/users/1%20OR%201=1"
```

The resulting SQL becomes:

```sql
SELECT userid, username, email, password, type, profile_pic_url,
       DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
FROM users WHERE userid = 1 OR 1=1;
```

Because `1=1` is always true, the query can return every row in the `users` table, including plain-text passwords.

**Step 4 - Replay exposed credentials:**

If passwords are exposed, an attacker can submit them directly to the login endpoint and receive a valid JWT token.

![GET /users/:userid proof of concept request](../Assets/Mike/get-users-poc.png)
This shows the injected `userid` payload submitted to the endpoint.

### 3. Database Storage

The affected table is `users`.

Relevant columns:

- `userid`
- `username`
- `email`
- `password`
- `type`
- `profile_pic_url`
- `created_at`

The inclusion of `password` in the query makes this issue more severe because a successful injection can expose credentials directly in the API response.

The SQL sink is the string interpolation in the model layer:

![GET /users/:userid vulnerable code](../Assets/Mike/get-users-code.png)
This shows the string interpolation that makes the injection possible.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/controller/app.js:308-320`

```javascript
app.get('/users/:userid', function (req, res) {
    var userid = req.params.userid;

    userDB.getUserByUserid(userid, function (err, results) {
        if (err) {
            console.log(err);
            res.status(500).send(err);
        } else {
            res.status(200).send(results);
        }
    });
});
```

**File:** `Assignment/BackEndServer/model/users.js:87-103`

```javascript
getUserByUserid: function (userid, callback) {
    var dbConn = db.getConnection();
    dbConn.connect(function (err) {
        if (err) { return callback(err, null); }

        var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
                                  FROM users where userid = ${userid};`;

        dbConn.query(getUserByUserIDSql, [], function (err, results) {
            dbConn.end();
            if (err) { return callback(err, null); }
            return callback(null, results);
        });
    });
}
```

### 5. Recommendations and Fix Code

The fix is to use a parameterized query and remove the password field from the response unless the endpoint explicitly needs it.

```javascript
getUserByUserid: function (userid, callback) {
    var dbConn = db.getConnection();
    dbConn.connect(function (err) {
        if (err) { return callback(err, null); }

        var getUserByUserIDSql = `
            SELECT userid, username, email, type, profile_pic_url,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
            FROM users
            WHERE userid = ?;
        `;

        dbConn.query(getUserByUserIDSql, [userid], function (err, results) {
            dbConn.end();
            if (err) { return callback(err, null); }
            return callback(null, results);
        });
    });
}
```

### 6. Testing Process

- Before fix: `curl "http://localhost:8081/users/1%20OR%201=1"` returns more rows than intended.
- After fix: the same request should not change the query structure and should return only the intended record or an error for invalid input.

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Identified the template literal interpolation in `users.js` |
| Browser | Navigated to the injected URL directly to confirm the response |
| Postman | Sent structured requests with varying `userid` payloads |

---

## Finding 2 - Stored XSS via Unescaped `innerHTML` in Review, Game, Category, and Platform Rendering

### 1. Vulnerability and Type of Flaw

**Type:** OWASP A03 - Injection / Stored Cross-Site Scripting (XSS)

Review content, game data, category data, and platform data are stored in the database and later inserted into the DOM using `innerHTML` without escaping or sanitization. That allows injected HTML content to execute in every visitor's browser when the affected pages render the stored values.

### 2. Exploitation

An attacker can submit a review payload such as:

```json
{
  "content": "<script>alert('XSS')</script>",
  "rating": 5
}
```

or a harmless browser test payload such as:

```json
{
  "content": "<img src=\"\" onerror=\"alert('this is a test')\">",
  "rating": 5
}
```

The stored payload should be shown where it is submitted:

![Stored XSS payload submitted via Postman](../Assets/Mike/xss-postman-payload.png)

When the review page renders that stored content, the browser can execute it or make an outbound request:

![Webhook request received during browser execution](../Assets/Mike/xss-webhook-token.png)

![XSS executing in victim browser](../Assets/Mike/xss-browser-execution.png)

### 3. Database Storage

The affected tables include:

- `review`
- `game`

### 4. Affected Code (with Location)

**File:** `Assignment/FrontEndServer/Public/newGame-Detail.html:92-103` (`renderReviews`)

```javascript
function renderReviews(reviews) {
    const out = document.getElementById('reviewDisplaySection');
    out.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'card p-3 mb-3';
        div.innerHTML = `
            <div class="d-flex gap-3">
                <strong>${r.username || 'User'}</strong>
                <div class="muted small">${r.created_at || ''} - Rating: ${r.rating || ''}</div>
                <p class="mt-2">${r.content || ''}</p>
            </div>
        `;
        out.appendChild(div);
    });
}
```

`r.content`, `r.username`, and `r.rating` are inserted directly into `innerHTML` with no escaping.

**File:** `Assignment/FrontEndServer/Public/newGame-Detail.html` (`game detail rendering`)

```javascript
document.getElementById('Game-Info-Display').innerHTML = `
    <h2>${g.title || ''}</h2>
    <p>${g.game_description || ''}</p>
    <p>${g.categories || ''} - ${g.year || ''}</p>
`;
```

Game data is also placed directly into HTML markup without output encoding.

**Additional affected inputs**

- add game title and description fields
- add category fields
- add platform fields

These are part of the same root cause if they are stored and later reflected or rendered with `innerHTML`.

**Additional frontend sinks hardened in the same fix**

The same XSS pattern also affected two other frontend views. In `addNewGame.html`, category and platform labels were previously injected as HTML, which meant a malicious database value could have executed when the checkbox lists rendered. In `gamesSearch.html`, the category and platform dropdown options and the game metadata line were also built from unescaped data, so a stored payload in those fields could have been interpreted as markup in the browser. Both pages now render dynamic values with DOM nodes and `textContent`, which prevents stored HTML from becoming executable script.

### 5. Recommendations and Fix Code

Replace `innerHTML` with DOM creation and `textContent` for all dynamic values.

```javascript
function renderReviews(reviews) {
    const out = document.getElementById('reviewDisplaySection');
    out.innerHTML = '';
    reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'card p-3 mb-3';

        const wrapper = document.createElement('div');
        wrapper.className = 'd-flex gap-3';

        const info = document.createElement('div');

        const strong = document.createElement('strong');
        strong.textContent = r.username || 'User';

        const meta = document.createElement('div');
        meta.className = 'muted small';
        meta.textContent = (r.created_at || '') + ' - Rating: ' + (r.rating || '');

        const content = document.createElement('p');
        content.className = 'mt-2';
        content.textContent = r.content || '';

        info.appendChild(strong);
        info.appendChild(meta);
        info.appendChild(content);
        wrapper.appendChild(info);
        div.appendChild(wrapper);
        out.appendChild(div);
    });
}
```

Apply the same pattern anywhere database values are rendered into the page. In this project, that includes the game details view, the review list, and the search/add-game filter builders.

### 6. Testing Process

- Before fix: submit a malicious review payload and confirm that the browser executes it.
- After fix: the same payload should be shown as plain text.
- Before fix: category/platform values could be injected into the add/search pages through `innerHTML`.
- After fix: those lists render as plain text labels and option values only.

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Identified the `innerHTML` sink in `renderReviews()` |
| Browser DevTools | Confirmed the unsanitized payload rendered as live HTML |
| webhook.site | Verified a controlled outbound request during testing |

---

## Finding 3 - SQL Injection in `POST /game`

### 1. Vulnerability and Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

The `title`, `game_description`, and `year` fields are wrapped in quotes and interpolated directly into an `INSERT` statement.

### 2. Exploitation

Submitting a quoted value in `title` can break the query syntax and cause a server error. More aggressive payloads can attempt to terminate the query early and append extra SQL.

![POST /game proof of concept request](../Assets/Mike/insertgame-request.png)
This shows the quoted title submitted as the payload.

![POST /game server error response](../Assets/Mike/insertgame-error.png)
This shows the server error caused by the injected input.

The sink is in the model query:

![POST /game vulnerable code](../Assets/Mike/insertgame-code.png)
This shows the interpolated `INSERT` statement that creates the sink.



### 3. Database Storage

The primary table is `game`, with related writes to `game_platform` and `game_category`.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/controller/app.js:435-471`

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

**File:** `Assignment/BackEndServer/model/game.js:153-160`

```javascript
var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
```

### 5. Recommendations and Fix Code

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

- Before fix: submit a quoted title such as `Test Game2'` and observe the error.
- After fix: the same input should be treated as data or rejected before reaching the query.

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Located the interpolated `INSERT` query |
| Postman | Triggered the failing game creation request |

---

## Finding 4 - SQL Injection in `updateGame()`

### 1. Vulnerability and Type of Flaw

**Type:** OWASP A03 - Injection / SQL Injection

`updateGame()` uses the same unsafe interpolation pattern as `insertGame()`. It places `title`, `game_description`, `year`, `game_image.buffer`, and `gameID` directly into the SQL text.

No public route currently calls this helper, so this is a code-level sink rather than a confirmed live exploit. It should still be fixed because it can become exploitable if the helper is wired into a route later.

### 2. Exploitation

There is no direct HTTP path to this helper in the current controller. If a future route passes raw request data into it, an attacker could inject through any of the interpolated values, including `gameID` in the `WHERE` clause.

### 3. Database Storage

The affected table is `game`.

### 4. Affected Code (with Location)

**File:** `Assignment/BackEndServer/model/game.js:293-306`

```javascript
var updateGameSql = `update game set title='${title}', game_description='${game_description}', year='${year}', game_image='${game_image.buffer}' where gameID='${gameID}`;
```

The exact sink is shown below:

![updateGame() vulnerable code](../Assets/Mike/updategame-code.png)
This shows the unsafe update query built with string interpolation.

The source search confirms the helper is not currently called from a controller route:

![updateGame() missing route](../Assets/Mike/updategame-search.png)
This shows that the helper is currently a code-level sink, not a confirmed live route.


### 5. Recommendations and Fix Code

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

- Before fix: inspect the helper and confirm it uses string interpolation.
- After fix: confirm the query uses `?` placeholders only.

### 7. Tools Used

| Tool | Purpose |
|------|---------|
| Manual code review | Found the unsafe update helper |
| Source search | Confirmed no controller route currently calls `updateGame()` directly |

---

## Conclusion

| Finding | Category | Severity | Status |
|---------|----------|----------|--------|
| 1 - SQL Injection in `GET /users/:userid` | A03 | High | Fixed |
| 2 - Stored XSS via review and game rendering | A03 | High | Fixed |
| 3 - SQL Injection in `POST /game` | A03 | High | Fixed |
| 4 - SQL Injection in `updateGame()` | A03 | Medium | Fixed |

The shared root cause across all findings is unsafe SQL and DOM construction. The correct fix is to use parameterized queries, validate inputs before they reach the model layer, and use safe DOM APIs such as `textContent` instead of `innerHTML`.
