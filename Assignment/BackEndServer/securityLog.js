const logger = require('./logger');

function audit(action, detail) {
    logger.info({
        message: 'audit',
        action: action,
        detail: detail || {}
    });
}

function safeError(err) {
    var message = (err && err.message) ? err.message : String(err);

    logger.error(message);
}

module.exports = { audit: audit, safeError: safeError };
