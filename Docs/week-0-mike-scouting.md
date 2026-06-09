# Week 0 - Mike Scouting Report

---
**Title:** Week 0 - A03 SQL Injection Scouting
**Written by:** Mike Franco Abat
**Collaborators:** Nachiketh, Sitt, Keefe
**Reviewed by:**
**Date:** 2026-06-09
---

## 1. Owner

- Name: Mike Franco Abat
- GitHub username: Mike-Franco
- Assigned OWASP category/categories: A03: Injection
- Date: 2026-06-09

## 2. Scope I Scouted

List the files, pages, endpoints, database tables, and flows you inspected.

| Area | File / URL / Endpoint | Why it matters |
| --- | --- | --- |
| Frontend | `Assignment/FrontEndServer/Public/addNewGame.html`, `Assignment/FrontEndServer/Public/newGame-Detail.html`, `Assignment/FrontEndServer/Public/gamesSearch.html` | These pages collect user input that is sent to the backend and help identify where attacker-controlled values reach SQL queries. |
| Backend route/controller | `Assignment/BackEndServer/controller/app.js` | Route handlers show which inputs are exposed through the API and which model methods they reach. |
| Model/database query | `Assignment/BackEndServer/model/users.js`, `Assignment/BackEndServer/model/game.js` | These files contain the SQL statements, including the unsafe string interpolation used in the vulnerable paths. |
| Database schema/data | `spgames_SC.sql` | Helps confirm table/column names and shows how the application stores users, games, categories, and reviews. |

## 3. Potential Vulnerabilities Found

| Candidate flaw | OWASP category | Evidence location | Detailed or brief? | Confidence |
| --- | --- | --- | --- | --- |
| SQL injection in `GET /users/:userid` | A03 | `controller/app.js:308`, `model/users.js:87-103` | Detailed | High |
| SQL injection in `POST /game` | A03 | `controller/app.js:435`, `model/game.js:153-160` | Detailed | High |
| SQL injection in `updateGame()` helper | A03 | `model/game.js:293-306` | Brief | High |

## 4. Exploit Scout Notes

### Finding 1: SQL injection in `GET /users/:userid`

- Preconditions: None
- Test account/role needed: None
- Request or page used: `GET /users/1`
- Expected impact: Attacker may alter the query through the `userid` path parameter and access unintended user records
- Safe test payload/demo idea: Try a harmless input like `1 OR 1=1` or a single quote to see whether the server returns an SQL error or unexpected results

### Finding 2: SQL injection in `POST /game`

- Preconditions: Access to the public game creation endpoint
- Test account/role needed: None, because the route has no auth check
- Request or page used: `POST /game` with form fields such as `title`, `description`, and `year`
- Expected impact: Crafted input can break the `INSERT` statement or change its meaning, risking data integrity
- Safe test payload/demo idea: Submit a value containing a single quote in `title` or `description` and observe whether the backend throws an SQL error

### Finding 3: SQL injection in `updateGame()` helper

- Preconditions: The helper is reachable from future or hidden update flows
- Test account/role needed: Depends on the calling route
- Request or page used: Any game update flow that passes user input into `updateGame()`
- Expected impact: The interpolation in the `UPDATE` statement can be abused if a route uses this helper
- Safe test payload/demo idea: Review the code path and confirm whether any update form passes raw input into the helper without parameterization

## 5. Code Evidence

```text
File: Assignment/BackEndServer/model/users.js
Lines: 87-103
Snippet:
  getUserByUserid: function (userid, callback) {
      ...
      var getUserByUserIDSql = `select userid, username, email, password, type, profile_pic_url,
                                  DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM users where userid = ${userid};`;
      dbConn.query(getUserByUserIDSql, [], function (err, results) {
          ...
      });
  }
```

```text
File: Assignment/BackEndServer/model/game.js
Lines: 153-160
Snippet:
  insertGame: function (title, game_description, year, game_image, callback) {
      ...
      var insertGameSql = `INSERT INTO game (title, game_description, year, game_image) VALUES ('${title}', '${game_description}', '${year}', ?);`;
      dbConn.query(insertGameSql, [game_image.buffer], function (err, results) {
          ...
      });
  }
```

```text
File: Assignment/BackEndServer/model/game.js
Lines: 293-306
Snippet:
  updateGame: function (title, game_description, year, game_image, gameID, callback) {
      ...
      var updateGameSql = `update game set title='${title}', game_description='${game_description}', year='${year}', game_image='${game_image.buffer}' where gameID='${gameID}`;
      dbConn.query(updateGameSql, [], function (err, results) {
          ...
      });
  }
```

```text
File: Assignment/BackEndServer/controller/app.js
Lines: 308-320, 435-471
Snippet:
  app.get('/users/:userid', function (req, res) {
      var userid = req.params.userid;
      userDB.getUserByUserid(userid, function (err, results) { ... });
  });

  app.post('/game', upload.single('game_image'), function (req, res) {
      var title = req.body.title;
      var game_description = req.body.description;
      var year = req.body.year;
      gameDB.insertGame(title, game_description, year, game_image, function (err, results) { ... });
  });
```

## 6. Fix Direction

- Recommended approach: Replace all string-interpolated SQL with parameterized queries and validate input types before sending them to the model layer
- Code area to change: `Assignment/BackEndServer/model/users.js` and `Assignment/BackEndServer/model/game.js`; also review any controller routes that forward raw input into these helpers
- Libraries/middleware needed: No new library is required for the core fix, but input validation middleware would help keep bad values out earlier
- Possible side effects: Existing frontend forms may need small changes if the backend starts rejecting malformed values instead of trying to execute them

## 7. Tools and Methods Used

Examples: browser devtools, curl, Postman, SQLMap, npm audit, manual code review.

- Tool/method: Manual code review
- What I tested: Route handlers and model queries that accept user-controlled input
- Result: Found 2 active SQL injection sinks and 1 additional unsafe helper function in the game model

## 8. What I Want To Do Next

Turn scouting into Week 1 action items.

- [x] Confirm the main SQL injection points
- [ ] Capture screenshots/logs
- [ ] Create proof-of-concept request or script
- [ ] Draft vulnerable-code explanation
- [ ] Draft fix snippet
- [ ] Ask teammate to review finding

## 9. Questions / Blockers

- None at the moment. The main open item is whether the team wants the brief A03 finding to use `POST /game` or the unused `updateGame()` helper.

## 10. Academic Integrity Reminder

Write in your own words. Do not copy another person's finding text. Collaboration is allowed for testing and review, but each person's scouting notes should show their own understanding.
