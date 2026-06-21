---
title: API Testing Guide for Bruno
author: Nachiketh Reddy
date: 2026-06-08
---

# API Testing Guide — Turbo Funicular

> Prerequisites: Backend running at `http://localhost:8081` via `pnpm run dev` from repo root.

## How to Use Bruno

1. Open Bruno from `/Applications/`
2. Click **New Collection** → name it `Turbo Funicular`
3. Click **New Request** for each test below
4. Set the method (GET/POST/DELETE) and URL
5. For POST requests, go to the **Body** tab and set it to **JSON**
6. Click the blue **Send** button

---

## 1. Health Check — Server is Running

### GET /game
Returns all games. No auth required.

| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/game` |
| Expected | `200` + JSON array of 3 games |

---

## 2. Public Endpoints (No Auth Required)

### GET /category
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/category` |
| Expected | `200` + array of game categories |

### GET /platform
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/platform` |
| Expected | `200` + array of platforms (PS5, PC, Xbox, etc.) |

### GET /game/:id
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/game/12` |
| Expected | `200` + Cyberpunk 2077 details |

### GET /game/:id/review
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/game/12/review` |
| Expected | `200` + all reviews for Cyberpunk |

### POST /searchgame
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/searchgame` |
| Body (JSON) | `{ "input": "Cyber", "platID": "", "catID": "" }` |
| Expected | `200` + matching games |

---

## 3. Authentication & Registration

### POST /users — Register a new user
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/users` |
| Body (JSON) | `{ "username": "testuser", "email": "test@test.com", "password": "test123", "type": "Customer", "profile_pic_url": "" }` |
| Expected | `201` + `{ "userid": "..." }` |

### POST /users — Register as admin (security test)
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/users` |
| Body (JSON) | `{ "username": "hacker", "email": "hacker@x.com", "password": "hack123", "type": "admin", "profile_pic_url": "" }` |
| Expected | `201` — anyone can create an admin account |
| Note | **Vulnerability!** No restriction on `type` field |

### POST /users/login
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/users/login` |
| Body (JSON) | `{ "email": "terry@gmail.com", "password": "abc123" }` |
| Expected | `200` + `{ "success": true, "token": "..." }` |
| Note | Save the `token` value for authenticated requests |

---

## 4. Broken Access Control Tests (A01)

### GET /users — Expose all users (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/users` |
| Expected | `200` + all 5 users **including passwords in plain text** |
| Note | **Vulnerability!** No auth required, and passwords are exposed |

### GET /users/:userid — IDOR (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/users/1` |
| Expected | `200` + Terry Tan's data including password |
| Note | **Vulnerability!** Just change the userid to see any user |

### DELETE /game/:id — Delete a game (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `DELETE` |
| URL | `http://localhost:8081/game/14` |
| Expected | `204` (game deleted) — anyone can delete any game |
| Note | **Vulnerability!** No auth check at all. ⚠️ Re-run the schema import to restore data: `mysql -u root -proot sp_games < spgames_SC.sql` |

### POST /users/:uid/game/:gid/review — Impersonate another user
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/users/1/game/12/review` |
| Body (JSON) | `{ "content": "Great game!", "rating": 5 }` |
| Expected | `201` — review posted as user ID 1 (Terry Tan) without being logged in as them |
| Note | **Vulnerability!** The uid comes from the URL, not from the JWT token |

### POST /game — Add a game (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/game` |
| Headers | `Content-Type: multipart/form-data` |
| Body (form) | `title=Test Game`, `description=A test`, `price=10`, `platformid=1`, `categoryid=1`, `year=2026` |
| Expected | `201` — anyone can add games without being admin |
| Note | **Vulnerability!** No role check |

### POST /category — Add a category (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/category` |
| Body (JSON) | `{ "catname": "TestCat", "description": "test" }` |
| Expected | `201` |

### POST /platform — Add a platform (NO AUTH)
| Field | Value |
|-------|-------|
| Method | `POST` |
| URL | `http://localhost:8081/platform` |
| Body (JSON) | `{ "platform_name": "TestPlatform", "description": "test" }` |
| Expected | `201` |

### GET /CheckRole — The ONLY endpoint with auth
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/CheckRole` |
| Headers | `Authorization: Bearer YOUR_TOKEN_HERE` |
| Expected | `200` + `{ "role": "Customer" }` |
| Note | With no token → `403 Not authorized` |

---

## 5. SQL Injection Tests (A03)

### GET /users/:userid — SQLi via userid parameter
| Field | Value |
|-------|-------|
| Method | `GET` |
| URL | `http://localhost:8081/users/1 OR 1=1` |
| Expected | May return all users — depends on DB error handling |
| Note | **Vulnerability!** `users.js:101` uses `${userid}` directly without parameterization |

---

## 6. Summary of All Endpoints

| # | Method | Endpoint | Auth Required? | Vulnerable? |
|---|--------|----------|:---:|:---:|
| 1 | GET | `/CheckRole` | ✅ Yes | No |
| 2 | GET | `/users` | ❌ No | **Yes** — IDOR, passwords exposed |
| 3 | GET | `/users/:userid` | ❌ No | **Yes** — IDOR, SQLi, passwords exposed |
| 4 | POST | `/users` | ❌ No | **Yes** — client-supplied role |
| 5 | POST | `/users/login` | ❌ No | No |
| 6 | POST | `/users/logout` | ❌ No | No |
| 7 | POST | `/users/:uid/game/:gid/review` | ❌ No | **Yes** — no ownership check |
| 8 | GET | `/game` | ❌ No | No (public read) |
| 9 | GET | `/game/:id` | ❌ No | No (public read) |
| 10 | GET | `/game/:id/review` | ❌ No | No (public read) |
| 11 | POST | `/game` | ❌ No | **Yes** — no role check |
| 12 | DELETE | `/game/:id` | ❌ No | **Yes** — no auth at all |
| 13 | POST | `/category` | ❌ No | **Yes** — no role check |
| 14 | POST | `/platform` | ❌ No | **Yes** — no role check |
| 15 | GET | `/category` | ❌ No | No (public read) |
| 16 | GET | `/platform` | ❌ No | No (public read) |
| 17 | GET | `/game_platform/:platform` | ❌ No | No (public read) |
| 18 | POST | `/searchgame` | ❌ No | No (public read) |
| 19 | GET | `/searchgamedetails/:gameID` | ❌ No | No (public read) |

---

## Restoring Deleted Data

If you accidentally delete data, re-import the schema:
```bash
mysql -u root -proot sp_games < spgames_SC.sql
```
