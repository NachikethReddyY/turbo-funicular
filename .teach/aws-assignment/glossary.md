---
tags: [topic/aws-assignment, type/glossary]
aliases: ["AWS Assignment Glossary"]
---

# AWS Assignment Glossary

Terms for the AWS additional-feature path in this assignment.

## Terms

**S3 bucket**:
An AWS storage container that can hold static frontend files such as `index.html`, CSS, JavaScript, and images.
_Avoid_: Calling it a server; S3 serves files, it does not run Node.js backend code.

**Static website hosting**:
An S3 feature that serves files from a bucket as a website endpoint.
_Avoid_: Mixing it up with backend hosting.

**Backend hosting**:
Running the Node.js Express API somewhere that can execute server code and connect to the database.
_Avoid_: Uploading `server.js` to S3 and expecting it to run.

**Secrets Manager**:
AWS service for storing secret values such as database passwords and JWT secrets outside source code.
_Avoid_: Screenshots that reveal the actual secret value.

**Cognito**:
AWS managed authentication service for user sign-up, sign-in, tokens, and user pools.
_Avoid_: Treating it as a database for games or reviews.

**Evidence screenshot**:
A screenshot that proves a feature was configured or working without leaking sensitive data.
_Avoid_: Capturing passwords, access keys, or unmasked secret values.
