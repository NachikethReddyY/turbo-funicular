const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(function (info) {
        return JSON.stringify({
            ts: info.timestamp,
            level: info.level,
            message: info.message,
            action: info.action,
            detail: info.detail || {},
            stack: info.stack
        });
    })
);

const transports = [
    new winston.transports.Console({
        format: logFormat
    }),

    new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        level: 'info',
        format: logFormat
    }),
];

const logger = winston.createLogger({
    level: 'info',
    transports: transports,
});

module.exports = logger;
