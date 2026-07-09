const {
    CognitoIdentityProviderClient,
    ListUsersCommand,
    AdminAddUserToGroupCommand,
    AdminRemoveUserFromGroupCommand
} = require('@aws-sdk/client-cognito-identity-provider');

function getClient() {
    return new CognitoIdentityProviderClient({
        region: process.env.COGNITO_REGION || 'us-east-1'
    });
}

function isCognitoConfigured() {
    return Boolean(process.env.COGNITO_USER_POOL_ID);
}

function getAdminGroupName() {
    return process.env.COGNITO_ADMIN_GROUP || 'Admin';
}

function escapeFilterValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function findUsernameByEmail(email) {
    if (!isCognitoConfigured()) {
        var configError = new Error('Cognito is not configured on the server.');
        configError.statusCode = 503;
        throw configError;
    }

    var response = await getClient().send(new ListUsersCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Filter: 'email = "' + escapeFilterValue(email) + '"',
        Limit: 1
    }));

    var user = response.Users && response.Users[0];

    if (!user) {
        return null;
    }

    return user.Username;
}

async function addUserToAdminGroup(email) {
    var username = await findUsernameByEmail(email);

    if (!username) {
        var notFound = new Error('No Cognito user found for that email.');
        notFound.statusCode = 404;
        throw notFound;
    }

    var groupName = getAdminGroupName();

    await getClient().send(new AdminAddUserToGroupCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
        GroupName: groupName
    }));

    return {
        cognitoUsername: username,
        group: groupName
    };
}

async function removeUserFromAdminGroup(email) {
    var username = await findUsernameByEmail(email);

    if (!username) {
        var notFound = new Error('No Cognito user found for that email.');
        notFound.statusCode = 404;
        throw notFound;
    }

    var groupName = getAdminGroupName();

    await getClient().send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID,
        Username: username,
        GroupName: groupName
    }));

    return {
        cognitoUsername: username,
        group: groupName
    };
}

module.exports = {
    isCognitoConfigured: isCognitoConfigured,
    getAdminGroupName: getAdminGroupName,
    addUserToAdminGroup: addUserToAdminGroup,
    removeUserFromAdminGroup: removeUserFromAdminGroup
};
