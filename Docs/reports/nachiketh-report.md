---
author: Nachiketh Reddy Y
module: ST2515 Secure Coding
date: June 2026
---

# Vulnerability Analysis Report — OWASP A01 & A09

> **Team consolidated report:** [consolidated-report.md](consolidated-report.md) — all findings in one document for submission.

This assessment is split into two standalone reports. Read them in order: **A01 first** (access control hardening), then **A09** (logging and monitoring — scoped after A01 fixes were applied).

| Report | Category | Findings | Screenshots |
|--------|----------|----------|-------------|
| **[nachiketh-report-a01.md](nachiketh-report-a01.md)** | A01 — Broken Access Control | 4 (auth, passwords, SQLi, JWT secret) | `Assets/Nachiketh/a01/` (embedded) |
| **[nachiketh-report-a09.md](nachiketh-report-a09.md)** | A09 — Security Logging & Monitoring Failures | 1 (audit, errors, enumeration, impersonation) | `Assets/Nachiketh/a09/` (embedded) |

---
    `
## Executive Summary

Security assessment of the **game catalogue web application** (Express.js API on port 8081, MySQL `sp_games`, JWT authentication) identified **five critical/high-severity vulnerabilities** across OWASP A01 and A09.

**Work sequence:**

1. **Scout and exploit (before-fix)** — Bruno, browser DevTools, backend terminal, VS Code.
2. **Remediate A01** — authentication, authorisation, SQL injection, JWT secret, sensitive `console.log` in `verifyToken.js`.
3. **Remediate A09** — structured audit logging, safe error output, generic duplicate messages, review ownership validation.
4. **Verify (after-fix)** — re-test; capture post-fix screenshots per [screenshot guide](../guides/nachiketh-screenshot-guide.md) (Parts 2 & 4).

**Overall risk:** Critical before remediation. Not production-ready until password hashing and persistent log storage are implemented.

---

## Finding Summary

| # | Finding | Category | Severity | Status | Report |
|---|---------|----------|----------|--------|--------|
| 1 | Missing Authentication & Authorisation | A01 | Critical | Fixed | [A01 § Finding 1](nachiketh-report-a01.md#finding-1--missing-authentication--authorisation-on-api-endpoints) |
| 2 | Plaintext Password Exposure | A01 | Critical | Partially fixed | [A01 § Finding 2](nachiketh-report-a01.md#finding-2--user-data-exposure-with-plaintext-passwords) |
| 3 | SQL Injection | A01 | Critical | Fixed | [A01 § Finding 3](nachiketh-report-a01.md#finding-3--sql-injection-in-database-queries) |
| 4 | Hardcoded JWT Secret | A01 | High | Fixed | [A01 § Finding 4](nachiketh-report-a01.md#finding-4--hardcoded-jwt-signing-secret) |
| 5 | Logging & Monitoring Failures | A09 | High | Fixed | [A09 report](nachiketh-report-a09.md) |

---

## Post-Fix Verification (Pending)

| Folder | Topic | Guide |
|--------|-------|-------|
| `Assets/Nachiketh/a01-after/` | A01 — 403 without token, admin vs customer, SQLi blocked | [nachiketh-screenshot-guide.md](../guides/nachiketh-screenshot-guide.md#part-2--a01-after-fix-assetsnachiketha01-after) |
| `Assets/Nachiketh/a09-after/` | A09 — audit lines, safe errors, generic duplicate, impersonation blocked | [nachiketh-screenshot-guide.md](../guides/nachiketh-screenshot-guide.md#part-4--a09-after-fix-assetsnachiketha09-after) |

---

*Submit `Docs/reports/nachiketh-report-a01.md`, `Docs/reports/nachiketh-report-a09.md`, and `Assets/Nachiketh/`.*
