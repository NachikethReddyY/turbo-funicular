var https = require('https');
var crypto = require('crypto');
var jwt = require('jsonwebtoken');

var jwksCache = null;
var jwksCacheExpiresAt = 0;

function getCognitoConfig() {
    var region = process.env.COGNITO_REGION || 'us-east-1';
    var userPoolId = process.env.COGNITO_USER_POOL_ID;
    var clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId || !clientId) {
        return null;
    }

    return {
        region: region,
        userPoolId: userPoolId,
        clientId: clientId,
        issuer: 'https://cognito-idp.' + region + '.amazonaws.com/' + userPoolId,
        jwksUri: 'https://cognito-idp.' + region + '.amazonaws.com/' + userPoolId + '/.well-known/jwks.json'
    };
}

function fetchJson(url, callback) {
    https.get(url, function (response) {
        var data = '';
        response.on('data', function (chunk) { data += chunk; });
        response.on('end', function () {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return callback(new Error('Unable to fetch JWKS: HTTP ' + response.statusCode));
            }

            try {
                callback(null, JSON.parse(data));
            } catch (err) {
                callback(err);
            }
        });
    }).on('error', callback);
}

function getSigningKey(header, callback) {
    var cognito = getCognitoConfig();
    var now = Date.now();

    function resolveKey(jwks) {
        var key = (jwks.keys || []).find(function (candidate) {
            return candidate.kid === header.kid;
        });

        if (!key) {
            return callback(new Error('No matching Cognito signing key found.'));
        }

        try {
            var publicKey = crypto.createPublicKey({ key: key, format: 'jwk' });
            callback(null, publicKey.export({ type: 'spki', format: 'pem' }));
        } catch (err) {
            callback(err);
        }
    }

    if (jwksCache && now < jwksCacheExpiresAt) {
        return resolveKey(jwksCache);
    }

    fetchJson(cognito.jwksUri, function (err, jwks) {
        if (err) {
            return callback(err);
        }

        jwksCache = jwks;
        jwksCacheExpiresAt = now + (60 * 60 * 1000);
        resolveKey(jwks);
    });
}

function verifyCognitoToken(token, req, res, next) {
    var cognito = getCognitoConfig();

    jwt.verify(token, getSigningKey, {
        algorithms: ['RS256'],
        issuer: cognito.issuer
    }, function (err, decoded) {
        if (err) {
            res.status(403);
            return res.json({ auth: false, message: 'Not authorized!' });
        }

        if (decoded.token_use !== 'access' || decoded.client_id !== cognito.clientId) {
            res.status(403);
            return res.json({ auth: false, message: 'Invalid Cognito token!' });
        }

        var groups = decoded['cognito:groups'] || [];
        var adminGroup = process.env.COGNITO_ADMIN_GROUP || 'Admin';

        req.userid = decoded.sub;
        req.cognitoUsername = decoded.username;
        req.cognitoGroups = groups;
        req.type = groups.includes(adminGroup) ? 'Admin' : 'user';
        next();
    });
}

function verifyLegacyToken(token, req, res, next) {
    var config = require('../config');

    jwt.verify(token, config.key, function (err, decoded) {
        if (err) {
            res.status(403);
            return res.json({ auth: false, message: 'Not authorized!' });
        }

        req.userid = decoded.userid;
        req.type = decoded.type;
        next();
    });
}

function verifyToken(req, res, next) {

    var token = req.headers['authorization']; //retrieve authorization header's content

    if (!token || !token.includes('Bearer')) { //process the token

        res.status(403);
        return res.send({ auth: 'false', message: 'Not authorized!' });
    }

    token = token.split('Bearer ')[1]; //obtain the token's value

    if (getCognitoConfig()) {
        return verifyCognitoToken(token, req, res, next);
    }

    return verifyLegacyToken(token, req, res, next);
}

module.exports = verifyToken;
