function audit(action, detail) {
    console.log(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'audit',
        action: action,
        detail: detail || {}
    }));
}

function safeError(err) {
    var message = (err && err.message) ? err.message : String(err);
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        message: message
    }));
}

module.exports = { audit: audit, safeError: safeError };
