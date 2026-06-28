# Cognito Migration Steps

This migration replaces the old local password login with AWS Cognito hosted login.

## Files Changed

- `Assignment/FrontEndServer/Public/login.html` - replaced local email/password form with Cognito redirect.
- `Assignment/FrontEndServer/Public/register.html` - replaced local registration form with Cognito redirect.
- `Assignment/FrontEndServer/Public/cognito-callback.html` - receives Cognito authorization-code callback.
- `Assignment/FrontEndServer/Public/js/cognito-auth.js` - handles Cognito PKCE login, callback token exchange, local session storage, and logout.
- `Assignment/BackEndServer/auth/verifyToken.js` - verifies Cognito access tokens using the User Pool JWKS.
- `Assignment/BackEndServer/controller/app.js` - blocks the old `/users/login` password endpoint.
- `Assignment/BackEndServer/.env.example` - documents required Cognito backend settings.

## AWS Cognito Settings

Use the existing Cognito app values:

```env
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_Nn98cdkS9
COGNITO_CLIENT_ID=78ub41p21tn42ahgeo4frrhc42
COGNITO_ADMIN_GROUP=Admin
```

In Cognito, create an `Admin` group and add admin users to that group. The backend maps membership in this group to the app's admin role.

## Frontend Config

Edit:

```text
Assignment/FrontEndServer/Public/js/cognito-auth.js
```

The Cognito hosted UI domain is:

```text
https://us-east-1nn98cdks9.auth.us-east-1.amazoncognito.com
```

## HTTPS Setup

S3 website endpoints are HTTP only. Cognito requires HTTPS callback URLs except for localhost testing.

Use this production-style path:

```text
S3 bucket -> CloudFront distribution -> HTTPS CloudFront domain -> Cognito callback URL
```

Set Cognito callback URL to:

```text
https://YOUR_CLOUDFRONT_DOMAIN/cognito-callback.html
```

Set Cognito sign-out URL to:

```text
https://YOUR_CLOUDFRONT_DOMAIN/newHome.html
```

## EC2 Backend Env

On EC2, update `~/BackEndServer/.env`:

```env
DB_HOST=localhost
DB_USER=spuser
DB_PASSWORD=sppassword
DB_NAME=sp_games
PORT=8081
JWT_SECRET=Assignment2key
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_Nn98cdkS9
COGNITO_CLIENT_ID=78ub41p21tn42ahgeo4frrhc42
COGNITO_ADMIN_GROUP=Admin
```

Restart the backend after changing `.env`.

## Deploy Order

1. Create/confirm Cognito User Pool and app client.
2. Create an `Admin` group in Cognito.
3. Add admin users to the `Admin` group.
4. Create CloudFront distribution with the S3 bucket as origin.
5. Add the CloudFront HTTPS callback/logout URLs to Cognito.
6. Fill the Cognito domain in `js/cognito-auth.js`.
7. Upload updated frontend files to S3.
8. Copy updated backend files to EC2.
9. Update EC2 `.env`.
10. Restart backend and test `/CheckRole` after login.

## Known Follow-Up

Reviews currently use numeric database user IDs, while Cognito users have a string `sub` value. Admin actions work with Cognito groups, but review posting needs a user-mapping table if the team wants Cognito users to create reviews as database users.
