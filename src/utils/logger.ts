/**
 * File: src/utils/logger.ts
 * 
 * Purpose: Professional logging system using Winston
 * Provides structured logging with different levels (info, warn, error, debug)
 * Logs are written to both console and file for debugging and audit trails.
 * 
 * Key Functions:
 * - createLogger(): Initializes Winston logger instance
 * - logSessionStart(): Logs when a simulation session begins
 * - logSessionEnd(): Logs when a simulation session completes
 * - logError(): Logs errors with stack traces
 * - logMetrics(): Logs performance metrics
 */

import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { SessionConfig, SessionMetrics } from '../types';

/**
 * Creates and configures Winston logger instance
 * 
 * @param logDirectory - Directory where log files will be stored
 * @returns Configured Winston logger instance
 * 
 * Features:
 * - Console output with colors for development
 * - File output for permanent audit trail
 * - Separate error log file for critical issues
 * - Timestamp on all log entries
 * - JSON formatting for easy parsing
 * 
 * Example:
 * const logger = createLogger('./logs');
 * logger.info('Simulation started');
 */
export function createLogger(logDirectory: string): winston.Logger {
    // Ensure log directory exists
    if (!fs.existsSync(logDirectory)) {
        fs.mkdirSync(logDirectory, { recursive: true });
    }

    const logFormat = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    );

    const logger = winston.createLogger({
        level: 'info',
        format: logFormat,
        defaultMeta: { service: 'traffic-simulator' },
        transports: [
            // Write all logs to combined.log
            new winston.transports.File({
                filename: path.join(logDirectory, 'combined.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 5
            }),
            // Write errors to error.log
            new winston.transports.File({
                filename: path.join(logDirectory, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 5
            }),
            // Write session metrics to separate file
            new winston.transports.File({
                filename: path.join(logDirectory, 'metrics.log'),
                level: 'info',
                maxsize: 10485760, // 10MB
                maxFiles: 10
            })
        ]
    });

    // Also log to console in development
    if (process.env.NODE_ENV !== 'production') {
        logger.add(new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }));
    }

    return logger;
}

/**
 * Logs the start of a simulation session
 * 
 * @param logger - Winston logger instance
 * @param session - Session configuration being started
 * 
 * Logged Information:
 * - Session ID
 * - User details (username, email)
 * - Proxy location (city, state)
 * - Device type and OS
 * - Start timestamp
 * 
 * Example:
 * logSessionStart(logger, sessionConfig);
 */
export function logSessionStart(
    logger: winston.Logger,
    session: SessionConfig
): void {
    logger.info('Session started', {
        sessionId: session.sessionId,
        user: {
            username: session.user.username,
            email: session.user.email,
            location: `${session.user.city}, ${session.user.zip}`
        },
        proxy: {
            ip: session.proxy.ip,
            location: `${session.proxy.city}, ${session.proxy.state}`
        },
        device: {
            type: session.device.type,
            os: session.device.os,
            browser: session.device.browser
        },
        timestamp: session.startTime.toISOString()
    });
}

/**
 * Logs the completion of a simulation session with metrics
 * 
 * @param logger - Winston logger instance
 * @param metrics - Session performance metrics
 * 
 * Logged Metrics:
 * - Session duration
 * - Pages visited count
 * - Actions performed
 * - Success/failure status
 * - Any error messages
 * 
 * Example:
 * logSessionEnd(logger, sessionMetrics);
 */
export function logSessionEnd(
    logger: winston.Logger,
    metrics: SessionMetrics
): void {
    const logData = {
        sessionId: metrics.sessionId,
        duration: metrics.duration ? `${(metrics.duration / 1000).toFixed(2)}s` : 'N/A',
        pagesVisited: metrics.pagesVisited,
        actionsPerformed: metrics.actionsPerformed,
        success: metrics.success,
        startTime: metrics.startTime.toISOString(),
        endTime: metrics.endTime?.toISOString()
    };

    if (metrics.success) {
        logger.info('Session completed successfully', logData);
    } else {
        logger.error('Session failed', {
            ...logData,
            errorMessage: metrics.errorMessage
        });
    }
}

/**
 * Logs errors with full stack traces
 * 
 * @param logger - Winston logger instance
 * @param message - Error description
 * @param error - Error object with stack trace
 * @param context - Additional context (session ID, user info, etc.)
 * 
 * Example:
 * logError(logger, 'Failed to load page', error, { sessionId: '123' });
 */
export function logError(
    logger: winston.Logger,
    message: string,
    error: Error,
    context?: Record<string, unknown>
): void {
    logger.error(message, {
        errorMessage: error.message,
        stack: error.stack,
        ...context
    });
}

/**
 * Logs performance metrics for analysis
 * 
 * @param logger - Winston logger instance
 * @param metrics - Key-value pairs of metrics
 * 
 * Use Cases:
 * - Page load times
 * - Network request counts
 * - Memory usage
 * - Success rates
 * 
 * Example:
 * logMetrics(logger, {
 *   avgPageLoadTime: 2.5,
 *   successRate: 0.95,
 *   totalSessions: 100
 * });
 */
export function logMetrics(
    logger: winston.Logger,
    metrics: Record<string, number | string>
): void {
    logger.info('Performance metrics', {
        type: 'metrics',
        timestamp: new Date().toISOString(),
        ...metrics
    });
}