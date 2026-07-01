---
tags: [topic/aws-assignment, type/references]
aliases: ["AWS Assignment References"]
---

# AWS Assignment References

## Knowledge

- [Assignment brief](../../assignment.html)
  Defines the additional features: AWS S3 frontend hosting, backend hosting, free hosting only, AWS Secrets Manager, and AWS Cognito.

- [Amazon S3 static website hosting - AWS Docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
  Use this for the official S3 website-hosting workflow and bucket website endpoint behavior.

- [AWS Amplify Hosting - AWS Docs](https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html)
  Use this to explain the production-friendly frontend hosting option AWS recommends for static sites and SPAs.

- [AWS Secrets Manager User Guide - AWS Docs](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
  Use this to understand what Secrets Manager stores and why application secrets should not live in source code.

- [Amazon Cognito User Pools - AWS Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)
  Use this for the official model of managed user sign-up, sign-in, and user directories.

- [Cognito app clients: public vs confidential - AWS Docs](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-client-apps.html)
  Use this when explaining why clientId in frontend JS is not a secret, and why PKCE is required for public clients.

- [Amazon CloudFront Developer Guide - AWS Docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html)
  Use this for HTTPS in front of S3 and Cognito callback URL setup.

- [Docs/cognito-migration-steps.md](../../Docs/cognito-migration-steps.md)
  Repo deploy checklist: Cognito env vars, CloudFront callback URLs, EC2 `.env`, deploy order.

- [Assignment/FrontEndServer/Public/js/cognito-auth.js](../../Assignment/FrontEndServer/Public/js/cognito-auth.js)
  Frontend PKCE login, token exchange, session storage. Reference when teaching public vs secret.

- [Assignment/BackEndServer/auth/verifyToken.js](../../Assignment/BackEndServer/auth/verifyToken.js)
  Backend JWKS verification and Admin group mapping. Reference when teaching token trust boundary.

## Wisdom (Communities)

- Your module/team chat
  Best place to confirm whether the lecturer expects a live demo or a documented architecture for optional AWS features.

## Gaps

- The assignment does not specify which backend host to use. For a student free-tier route, Elastic Beanstalk, EC2 free tier, Render/Railway free plans, or local demo plus S3 frontend evidence may be acceptable depending on lecturer expectations.
