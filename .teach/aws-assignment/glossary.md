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

**Public client**:
A Cognito app client with no client secret, used by browser SPAs. The client ID is visible by design; PKCE protects the authorization code exchange.
_Avoid_: Treating the client ID like a password or moving it to Secrets Manager.

**PKCE (Proof Key for Code Exchange)**:
An OAuth extension where the browser sends a code challenge at login and proves possession of the verifier at token exchange. Required best practice for public clients.
_Avoid_: Using the implicit grant flow in new browser apps.

**JWKS**:
JSON Web Key Set — Cognito's published public keys. The backend fetches these to verify token signatures without storing Cognito's private keys.
_Avoid_: Verifying Cognito tokens with your own JWT_SECRET.

**Callback URL**:
The HTTPS URL Cognito redirects to after login, e.g. `https://your-cloudfront-domain/cognito-callback.html`. Must be pre-registered in the app client.
_Avoid_: Using the S3 HTTP website endpoint as a production callback URL.

**CloudFront**:
AWS CDN that provides an HTTPS domain in front of S3. Needed because S3 static website endpoints are HTTP-only and Cognito requires HTTPS callbacks (except localhost).
_Avoid_: Assuming S3 alone satisfies Cognito's HTTPS requirement.
