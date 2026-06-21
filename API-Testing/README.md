# API Testing (Bruno)

1. Open collection: `opencollection.yml`
2. Run **`09 - Login Admin (John)`** → copy `token` from response
3. Collection **Auth** → Bearer Token → paste token
4. Requests with `auth: inherit` use that token automatically

| Token type | Login | Used for |
|------------|-------|----------|
| Admin | `John@gmail.com` / `abc123` | 20–25, 24, admin endpoints |
| Customer | `terry@gmail.com` / `abc123` | 15 impersonate (before fix only) |

After A09 fixes, request **15** with Terry's token should return **403** when posting as user 1.
