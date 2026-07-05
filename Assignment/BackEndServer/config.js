/* Old
var secret='Assignment2key'; //your own secret key
module.exports.key = secret; // Potential A07 Threat
*/

// Method 1
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required.");
}

module.exports = {
    key: process.env.JWT_SECRET
};


// Location: Assignment/BackEndServer/config.js (AWS Dynamic Integration)
/*require('dotenv').config();

const {
    SecretsManagerClient,
    GetSecretValueCommand
} = require("@aws-sdk/client-secrets-manager");

const secretsClient = new SecretsManagerClient({
    region: "us-east-1"
});

async function fetchApplicationSecrets() {

    const secretIdName = "assignment/backend/config";

    try {

        const cloudResponse = await secretsClient.send(
            new GetSecretValueCommand({
                SecretId: secretIdName,
                VersionStage: "AWSCURRENT"
            })
        );

        if (cloudResponse.SecretString) {

            const parsedSecrets = JSON.parse(cloudResponse.SecretString);

            process.env.JWT_SECRET = parsedSecrets.JWT_SECRET;
            process.env.DB_PASSWORD = parsedSecrets.DB_PASSWORD;

            console.log("[SECURITY] AWS Secrets loaded successfully.");

            return parsedSecrets;
        }

        throw new Error("SecretString is empty");

    } catch (error) {

        console.warn(
            "[WARN] AWS Secrets Manager unavailable. Switching to fallback config."
        );

        //  Fallback (so your server still runs)
        const fallbackSecrets = {
            JWT_SECRET: process.env.JWT_SECRET || "dev-jwt-secret",
            DB_PASSWORD: process.env.DB_PASSWORD || "dev-password"
        };

        process.env.JWT_SECRET = fallbackSecrets.JWT_SECRET;
        process.env.DB_PASSWORD = fallbackSecrets.DB_PASSWORD;

        return fallbackSecrets;
    }
}

module.exports = {
    fetchApplicationSecrets
}*/