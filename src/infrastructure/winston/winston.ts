import { Logger } from '@domain/types/Common';
import { createLogger, format, transports, config, Logger as WinstonLogger } from 'winston';

export enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
    DEBUG = 'debug',
}

// Adapter class implementing the Logger interface using Winston
export class WinstonLoggerAdapter implements Logger {
    private logger: WinstonLogger;

    constructor() {
        // Configure Winston logger
        this.logger = createLogger({
            level: 'info',
            levels: config.npm.levels,
            format: format.combine(
                format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                }),
            ),
            transports: [
                process.env.NODE_ENV == 'dev'
                    ? new transports.Console()
                    : new transports.Console({
                          format: format.combine(format.cli(), format.splat()),
                      }),
            ],
        });
    }

    info(message: string, ...optionalParams: any[]): void {
        this.logger.info(message, ...optionalParams);
    }

    warn(message: string, ...optionalParams: any[]): void {
        this.logger.warn(message, ...optionalParams);
    }

    error(message: string, ...optionalParams: any[]): void {
        this.logger.error(message, ...optionalParams);
    }

    debug(message: string, ...optionalParams: any[]): void {
        this.logger.debug(message, ...optionalParams);
    }

    log(level: LogLevel, message: string, ...optionalParams: any[]): void {
        this.logger.log(level, message, ...optionalParams);
    }
}

export default new WinstonLoggerAdapter();
