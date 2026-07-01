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

## Import SQL Users into Cognito (CSV)

Cognito **cannot import passwords**. Imported users must set a new password on first login (Forgot password / reset flow).

### 1. CSV file (already generated from your MySQL `users` table)

```text
Docs/cognito-users-import.csv
```

8 users exported: Terry, bob, John, Tim, Alex, and 3 test users.

Regenerate after DB changes:

```bash
bash scripts/export-cognito-users-csv.sh
```

Or download Cognito's template from **Users → Import users → Create import job → template.csv** and match the same columns.

### 2. Console import steps

1. **Cognito** → **User pools** → **User pool - iddlkj**
2. **Users** → **Import users** → **Create import job**
3. Job name: e.g. `sp-games-sql-import`
4. **Create a new IAM role** (console creates CloudWatch Logs role for you)
5. **Choose file** → upload `Docs/cognito-users-import.csv`
6. **Create and start job**
7. Wait for status **Succeeded** (check **Import users** list; view CloudWatch logs if failed)

Common failure: `email_verified` not `TRUE` — the CSV already sets this.

### 3. After import — Admin group

CSV does not assign groups. Manually add admins:

1. **User management → Groups** → create **Admin** (if missing)
2. **Users** → select **John@gmail.com** → **Add to group** → **Admin**
3. Repeat for **Tim@gmail.com**

### 4. First login for imported users

Old SQL passwords (`abc123` etc.) **do not work** in Cognito.

1. Open `http://localhost:3001/login.html` → **Continue to Cognito**
2. Enter email (e.g. `John@gmail.com`)
3. Click **Forgot password?** on Hosted UI
4. Enter code from email → set new password
5. Sign in with the new password

## Learner Lab fallback (CloudFront blocked)

If CloudFront is not allowed in AWS Academy, use localhost callbacks for Cognito demo and document S3 HTTP hosting separately. See `.teach/aws-assignment/lessons/cognito-s3-ec2-security.html`.

## Known Follow-Up

Reviews currently use numeric database user IDs, while Cognito users have a string `sub` value. Admin actions work with Cognito groups, but review posting needs a user-mapping table if the team wants Cognito users to create reviews as database users.
