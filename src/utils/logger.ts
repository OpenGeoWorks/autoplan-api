import { createLogger, format, transports, config } from 'winston';

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: config.npm.levels,
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`),
    ),
    transports: [
        process.env.NODE_ENV === 'dev'
            ? new transports.Console()
            : new transports.Console({ format: format.combine(format.cli(), format.splat()) }),
    ],
});

export default logger;
