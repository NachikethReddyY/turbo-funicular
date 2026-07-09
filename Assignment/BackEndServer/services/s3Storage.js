const crypto = require('crypto');
const { PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');

const bucket = process.env.S3_BUCKET || '';
const region = process.env.S3_REGION || process.env.COGNITO_REGION || 'us-east-1';

let client = null;

function isConfigured() {
    return Boolean(bucket);
}

function getClient() {
    if (!client) {
        client = new S3Client({ region: region });
    }

    return client;
}

function getPublicUrl(key) {
    var customBase = process.env.S3_PUBLIC_BASE_URL;

    if (customBase) {
        return customBase.replace(/\/$/, '') + '/' + key;
    }

    return 'https://' + bucket + '.s3.' + region + '.amazonaws.com/' + key;
}

function sanitizeFilename(name) {
    return String(name || 'image')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';
}

function uploadBuffer(buffer, key, contentType, callback) {
    if (!isConfigured()) {
        return callback(new Error('S3_BUCKET is not configured'));
    }

    getClient().send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
    })).then(function () {
        callback(null, getPublicUrl(key));
    }).catch(callback);
}

function uploadGameImage(file, title, callback) {
    if (!file || !file.buffer) {
        return callback(new Error('Game image file is required'));
    }

    var ext = file.mimetype === 'image/png' ? 'png' : 'jpg';
    var key = 'images/games/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex') +
        '-' + sanitizeFilename(title) + '.' + ext;

    uploadBuffer(file.buffer, key, file.mimetype || 'image/jpeg', callback);
}

function uploadProfileImageBase64(base64, ownerKey, callback) {
    var buffer = Buffer.from(base64, 'base64');
    var key = 'images/users/' + sanitizeFilename(ownerKey) + '-' + Date.now() + '.jpg';

    uploadBuffer(buffer, key, 'image/jpeg', callback);
}

module.exports = {
    isConfigured: isConfigured,
    uploadGameImage: uploadGameImage,
    uploadProfileImageBase64: uploadProfileImageBase64,
    getPublicUrl: getPublicUrl
};
