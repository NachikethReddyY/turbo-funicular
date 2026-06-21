# A09 Starting Point — Complete Overview

## You Are Here: Issue Identification Phase ✅

You asked: "What's the scoping for A09? What are we looking for? Point me to all issues without code changes."

**We've now completed that!** Here's everything documented:

---

## What We Found

### 2 Main Findings (OWASP A09 - Security Logging & Monitoring Failures)

**Finding 1 (DETAILED):** Missing Audit Logging on Sensitive Operations
- **Severity:** CRITICAL
- **Issue:** Zero structured logging of security events (registration, login, admin actions, etc.)
- **Impact:** Can't detect attacks, can't investigate breaches, can't meet compliance

**Finding 2 (BRIEF):** Information Leakage via Logging & Enumeration
- **Severity:** HIGH  
- **Issue:** Sensitive data logged to console; error messages reveal which users exist
- **Impact:** Attackers can build valid user lists and understand system architecture

---

## Where Are the Issues?

### Backend (42 instances across 4 files)

| File | Issue | Lines | Count |
|------|-------|-------|-------|
| **controller/app.js** | console.log(err) | 78, 106, 175, 201, 228, 268, 278, 288, 318, 355, 366, 405, 415, 451, 467, 479, 510, 538, 569, 598, 661 | 25 |
| **controller/app.js** | Enumeration errors | 272, 282, 359, 409 | 4 |
| **controller/app.js** | Debug logging | 159, 445, 462 | 3 |
| **auth/verifyToken.js** | console.log(token) | 17 | 1 |
| **model/users.js** | console.log(err) | 131, 143 | 2 |
| **model/users.js** | console.log(token) | 154 | 1 |
| **MISSING** | Audit logging | ALL endpoints | ∞ |

### Frontend (4 instances across 4 files)

| File | Issue | Lines | Count |
|------|-------|-------|-------|
| **login.html** | console.error() | 109 | 1 |
| **admin.html** | console.error() | 95 | 1 |
| **register.html** | console.error() | 154 | 1 |
| **newHome.html** | console.error() | 69 | 1 |

---

## Documentation Created (4 Files)

1. **A09-VISUAL-SUMMARY.md** ← Start here for visual explanation
2. **A09-scoping-and-findings.md** ← Complete issue inventory with details
3. **A09-screenshot-capture-guide.md** ← Step-by-step capture instructions
4. **A09-READY-FOR-SCREENSHOTS.md** ← Quick reference checklist
5. **A09-STARTING-POINT.md** ← This file (you are here)

---

## Next Phase: Screenshot Collection (You Are Here ↓)

### What You Need to Do

1. **Start backend server** (keep it running)
2. **Perform API actions** (register user, login, delete game, etc.)
3. **Take screenshots** of:
   - Backend console (showing no audit logging)
   - Error responses (showing enumeration vulnerabilities)
   - API responses (showing information leakage)
   - Source code (showing vulnerable patterns)
   - Browser console (showing frontend error logging)

### Total Screenshots Needed: 10

- 3 Backend console screenshots
- 2 Enumeration attack screenshots
- 1 Frontend console screenshot
- 4 Code snapshot screenshots

**Time estimate:** 30-45 minutes

### Files to Create

All screenshots go in: `Assignment/Assets/Nachiketh/`
- 08-backend-console-no-logging.png
- 09-console-sql-error-exposed.png
- 10-enumeration-username-exists.png
- 11-enumeration-email-exists.png
- 12-enumeration-username-contrast.png
- 13-frontend-console-error.png
- code/app.js-console-logging-pattern.png
- code/verifyToken.js-token-logging.png
- code/users.js-sensitive-logging.png
- code/app.js-enumeration-errors.png

---

## How to Get Started

### Step 1: Read Visual Summary (5 min)
```bash
open /Users/nr/Developer/turbo-funicular/Docs/A09-VISUAL-SUMMARY.md
# Understand what A09 is and why it matters
```

### Step 2: Read Capture Guide (10 min)
```bash
open /Users/nr/Developer/turbo-funicular/Docs/A09-screenshot-capture-guide.md
# Follow the detailed step-by-step instructions
```

### Step 3: Start Backend Server
```bash
cd /Users/nr/Developer/turbo-funicular/Assignment/BackEndServer
npm start
# Keep this running while capturing screenshots
```

### Step 4: Start Capturing Screenshots (30-45 min)
Follow the guide in A09-screenshot-capture-guide.md

---

## Key Points to Remember

✅ **We identified all issues** — No code changes yet!  
✅ **We have a detailed guide** — Just follow the steps  
✅ **Backend must be running** — To see console output and API responses  
✅ **10 screenshots total** — Mix of console, API, and code  
✅ **Exact file names matter** — They'll be referenced in the report  

---

## After Screenshots Are Collected

Once you have all 10 screenshots:

1. ✅ Organize them in `Assignment/Assets/Nachiketh/`
2. ⏳ Write the A09 report (2 findings, 7-point structure each)
3. ⏳ Document all findings with screenshot evidence
4. ⏳ Plan fixes (structured logging setup)
5. ⏳ Implement fixes (code changes)
6. ⏳ Verify fixes (testing)

---

## Quick Reference

**Where are the issues documented?**
- All issues listed in: `A09-scoping-and-findings.md`

**How do I capture screenshots?**
- Step-by-step guide in: `A09-screenshot-capture-guide.md`

**What should each screenshot show?**
- Details in: `A09-READY-FOR-SCREENSHOTS.md`

**Why is A09 important?**
- Explanation in: `A09-VISUAL-SUMMARY.md`

---

## Current Status

- ✅ A09 scope defined
- ✅ All issues identified and documented
- ✅ Capture guide created
- ✅ No code changes made
- ⏳ **NEXT: Capture screenshots**
- ⏳ Write report
- ⏳ Implement fixes

---

**Ready? Start with `A09-VISUAL-SUMMARY.md` → Then follow `A09-screenshot-capture-guide.md`**

Questions? Check the relevant documentation file above.
