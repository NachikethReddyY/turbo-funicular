---
tags: [type/knowledge-map]
aliases: ["Knowledge Map"]
---

# Knowledge Map

## AWS Assignment

- [[aws-assignment/mission.md|Mission]] connects the assignment's additional features to a deployable architecture.
- [[aws-assignment/lessons/aws-additional-features.html|Lesson 1: AWS overview]] teaches the S3, backend hosting, Secrets Manager, and Cognito path.
- [[aws-assignment/lessons/cognito-s3-ec2-security.html|Lesson 2: Cognito security wiring]] deepens Lesson 1 with public vs secret rules, PKCE/JWKS flow, CloudFront HTTPS, and the repo deploy checklist.
- [[Docs/cognito-migration-steps.md|cognito-migration-steps.md]] is the repo's operational deploy doc; Lesson 2 references it for EC2 env and callback URLs.
- Frontend auth lives in `Assignment/FrontEndServer/Public/js/cognito-auth.js`; backend verify in `Assignment/BackEndServer/auth/verifyToken.js`.
