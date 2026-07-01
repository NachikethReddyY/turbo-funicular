#!/usr/bin/env bash
# Regenerate Docs/cognito-users-import.csv from local MySQL sp_games.users
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/Assignment/BackEndServer/.env"
OUT="$ROOT/Docs/cognito-users-import.csv"

if [[ -f "$ENV_FILE" ]]; then
  DB_HOST="$(grep '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
  DB_USER="$(grep '^DB_USER=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
  DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
  DB_NAME="$(grep '^DB_NAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r')"
fi

DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-root}"
DB_NAME="${DB_NAME:-sp_games}"

HEADER="cognito:username,name,given_name,family_name,middle_name,nickname,preferred_username,profile,picture,website,email,email_verified,gender,birthdate,zoneinfo,locale,phone_number,phone_number_verified,address,updated_at,cognito:mfa_enabled"

{
  echo "$HEADER"
  mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -e \
    "SELECT CONCAT(email, ',', REPLACE(username, ',', '\\\\,'), ',,,,,,,,,', email, ',TRUE,,,,,,,,,FALSE') FROM users WHERE email IS NOT NULL AND email != '' ORDER BY userid;"
} > "$OUT"

echo "Wrote $(tail -n +2 "$OUT" | wc -l | tr -d ' ') users to $OUT"
echo "After import, add Admin group in Cognito for: John@gmail.com, Tim@gmail.com"
echo "Imported users must reset password on first Cognito login (passwords are not imported)."
