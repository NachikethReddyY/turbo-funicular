# Cryptix — Security Analysis of a Game Store Web App

A team-based cybersecurity project analyzing a web application for OWASP Top 10 vulnerabilities. Each team member scouted, exploited, and documented findings for assigned categories, then proposed fixes.

## Team

| Name | GitHub | Assigned OWASP |
|------|--------|----------------|
| **Nachiketh Reddy Y** | [NachikethReddyY](https://github.com/NachikethReddyY) | A01 (Broken Access Control) + A09 (Logging & Monitoring) |
| **Mike Franco Abat** | — | A03 (SQL Injection) |
| **Sitt** | — | A04 (Insecure Design) |
| **Keefe** | https://github.com/Keefeinfotech| A07 (Authentication Failures) |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express |
| Frontend | HTML, CSS, JavaScript |
| Database | MySQL (`sp_games`) |
| Auth | JWT (jsonwebtoken) |
| Dev Tools | Bruno, DataGrip, OrbStack, K9s |

## Project Structure

```
turbo-funicular/
├── Assignment/
│   ├── BackEndServer/         ← Express API (port 3001)
│   │   ├── controller/app.js  ← All route handlers
│   │   ├── model/             ← Database queries
│   │   ├── auth/verifyToken.js← JWT middleware
│   │   └── server.js          ← Server entry point
│   ├── FrontEndServer/        ← Static frontend pages
│   │   └── Public/*.html      ← Login, register, game search
│   └── Assets/                ← Screenshots and media
├── Docs/
│   ├── README.md              ← documentation index
│   ├── guides/                ← API testing, post-fix screenshots
│   ├── reports/               ← vulnerability reports
│   ├── templates/             ← course templates
│   ├── scouting/              ← week 0 scouting (team)
│   └── tracking/              ← fix tracker, progress log
├── API-Testing/               ← Bruno collection
├── spgames_SC.sql              ← Database schema + sample data
└── package.json                ← Root scripts
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22) — managed via `fnm`
- [pnpm](https://pnpm.io/) — package manager
- [MySQL](https://www.mysql.com/) 8.0+
- [Bruno](https://www.usebruno.com/) — for API testing (optional)

### 1. Clone and Install

```bash
git clone https://github.com/NachikethReddyY/turbo-funicular.git
cd turbo-funicular
pnpm install --prefix Assignment/BackEndServer
```

### 2. Set Up the Database

```bash
# Import schema and sample data
mysql -u nr -p sp_games < spgames_SC.sql
```

### 3. Configure Environment

Copy the template and fill in your credentials:

```bash
cp Assignment/BackEndServer/.env.example Assignment/BackEndServer/.env
```

Edit `.env`:
```env
DB_HOST=localhost
DB_USER=nr
DB_PASSWORD=your_password
DB_NAME=sp_games
PORT=3001
```

### 4. Start the Server

```bash
pnpm run dev
```

The app runs at **http://localhost:3001**.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/CheckRole` | ✅ | Verify user role from JWT |
| `GET` | `/users` | ❌ | List all users (includes passwords) |
| `GET` | `/users/:userid` | ❌ | Get a single user |
| `POST` | `/users` | ❌ | Register a new user |
| `POST` | `/users/login` | ❌ | Login, returns JWT |
| `POST` | `/users/logout` | ❌ | Clear session |
| `POST` | `/users/:uid/game/:gid/review` | ❌ | Add a review |
| `GET` | `/game` | ❌ | List all games |
| `GET` | `/game/:id` | ❌ | Get game details |
| `GET` | `/game/:id/review` | ❌ | Get reviews for a game |
| `POST` | `/game` | ❌ | Add a new game |
| `DELETE` | `/game/:id` | ❌ | Delete a game |
| `POST` | `/category` | ❌ | Add a category |
| `GET` | `/category` | ❌ | List categories |
| `POST` | `/platform` | ❌ | Add a platform |
| `GET` | `/platform` | ❌ | List platforms |
| `GET` | `/game_platform/:platform` | ❌ | Games by platform |
| `POST` | `/searchgame` | ❌ | Search games |
| `GET` | `/searchgamedetails/:gameID` | ❌ | Search game details |

See [`Docs/guides/api-testing.md`](Docs/guides/api-testing.md) for full test cases.

## OWASP Findings

### A01 — Broken Access Control (Nachiketh)
- No authentication on 13/14 endpoints
- IDOR: any user can view/search/delete any resource
- Client-supplied role on registration (register as admin)
- No ownership verification on reviews

### A03 — SQL Injection (Mike)
- String interpolation in `getUserByUserid`, `insertGame`, `updateGame`

### A04 — Insecure Design (Sitt)
- *To be documented*

### A07 — Authentication Failures (Keefe)
- *To be documented*

### A09 — Security Logging & Monitoring (Nachiketh)
- Zero structured logging (only `console.log`)
- No audit trail for sensitive operations
- No failed-login tracking

## Documentation

- [Docs index](Docs/README.md)
- [Nachiketh report (A01 + A09)](Docs/reports/nachiketh-report.md)
- [Post-fix screenshots guide](Docs/guides/postfix-screenshots.md)
- [API testing (Bruno)](API-Testing/README.md)
- [Scouting — Nachiketh](Docs/scouting/week-0-nachiketh-scouting.md)
- [Weekly progress log](Docs/tracking/log.md)

## License

Academic project — Singapore Polytechnic.
