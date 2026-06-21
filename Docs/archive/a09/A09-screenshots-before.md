# A09 Screenshot Reference

See [reports/nachiketh-report.md](../reports/nachiketh-report.md) for the full Finding 5 write-up.

**Before-fix evidence** lives in `Assets/Nachiketh/a09/` (captured).

**After-fix evidence** to capture in `Assets/Nachiketh/a09-after/`:

| File | How |
|------|-----|
| `audit-register-terminal.png` | Admin token → POST /users → terminal shows JSON audit line |
| `safe-error-terminal.png` | POST /game bad body → terminal shows `{"level":"error","message":...}` only |
| `generic-duplicate.png` | Bruno duplicate register → same message for username or email |
| `impersonate-blocked.png` | Terry token → POST review as user 1 → **403** |
| `audit-login-terminal.png` | Login → terminal shows `login_success` audit line |
