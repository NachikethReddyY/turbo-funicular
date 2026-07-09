const winston = require('winston');
const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'logs');
fs.mkdirSync(logDir, { recursive: true });

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(function (info) {
        const payload = {
            ts: info.timestamp,
            level: info.level,
            message: typeof info.message === 'string' ? info.message : 'log',
            action: info.action,
            detail: info.detail || {},
            stack: info.stack
        };

        if (typeof info.message === 'object' && info.message !== null) {
            payload.message = info.message.message || payload.message;
            payload.action = info.message.action || payload.action;
            payload.detail = info.message.detail || payload.detail;
        }

        return JSON.stringify(payload);
    })
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports: [
        new winston.transports.Console({ format: logFormat }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            level: 'info',
            format: logFormat
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: logFormat
        })
    ]
});

module.exports = logger;
