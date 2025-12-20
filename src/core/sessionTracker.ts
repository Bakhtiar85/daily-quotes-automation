/**
 * File: src/core/sessionTracker.ts
 * 
 * Purpose: Tracks active sessions and collects performance metrics
 * Maintains state of all running simulations, prevents conflicts,
 * and aggregates statistics for analysis.
 * 
 * Key Functions:
 * - SessionTracker class: Main tracker for managing active sessions
 * - addSession(): Registers new active session
 * - removeSession(): Marks session as complete
 * - getActiveCount(): Returns number of currently running sessions
 * - getMetrics(): Returns aggregated performance statistics
 */

import { SessionConfig, SessionMetrics } from '../types';
import * as winston from 'winston';

/**
 * SessionTracker class manages all active simulation sessions
 * 
 * Responsibilities:
 * - Track active sessions (prevent proxy conflicts)
 * - Collect performance metrics
 * - Calculate success rates
 * - Monitor resource usage
 * 
 * Example:
 * const tracker = new SessionTracker(logger);
 * tracker.addSession(sessionConfig);
 * // ... run simulation ...
 * tracker.removeSession(sessionId, metrics);
 */
export class SessionTracker {
    private activeSessions: Map<string, SessionConfig>;
    private completedSessions: SessionMetrics[];
    private logger: winston.Logger;
    private startTime: Date;

    /**
     * Initializes session tracker
     * 
     * @param logger - Winston logger instance
     */
    constructor(logger: winston.Logger) {
        this.activeSessions = new Map();
        this.completedSessions = [];
        this.logger = logger;
        this.startTime = new Date();

        this.logger.info('SessionTracker initialized');
    }

    /**
     * Registers a new active session
     * 
     * @param session - Session configuration to track
     * @throws Error if session ID already exists
     * 
     * Example:
     * tracker.addSession(sessionConfig);
     */
    public addSession(session: SessionConfig): void {
        if (this.activeSessions.has(session.sessionId)) {
            throw new Error(`Session ${session.sessionId} is already active`);
        }

        this.activeSessions.set(session.sessionId, session);

        this.logger.info('Session added to tracker', {
            sessionId: session.sessionId,
            activeCount: this.activeSessions.size,
            user: session.user.username
        });
    }

    /**
     * Removes session from active tracking and stores its metrics
     * 
     * @param sessionId - ID of session to remove
     * @param metrics - Performance metrics from completed session
     * 
     * Example:
     * tracker.removeSession('session-123', sessionMetrics);
     */
    public removeSession(sessionId: string, metrics: SessionMetrics): void {
        if (!this.activeSessions.has(sessionId)) {
            this.logger.warn('Attempting to remove non-existent session', {
                sessionId
            });
            return;
        }

        this.activeSessions.delete(sessionId);
        this.completedSessions.push(metrics);

        this.logger.info('Session removed from tracker', {
            sessionId,
            activeCount: this.activeSessions.size,
            completedCount: this.completedSessions.length,
            success: metrics.success
        });
    }

    /**
     * Returns number of currently active sessions
     * 
     * @returns Count of active sessions
     * 
     * Example:
     * const count = tracker.getActiveCount();
     * console.log(`${count} sessions running`);
     */
    public getActiveCount(): number {
        return this.activeSessions.size;
    }

    /**
     * Returns array of all active session IDs
     * 
     * @returns Array of session IDs currently running
     */
    public getActiveSessions(): string[] {
        return Array.from(this.activeSessions.keys());
    }

    /**
     * Calculates and returns aggregated metrics from all completed sessions
     * 
     * @returns Object containing performance statistics
     * 
     * Metrics Included:
     * - Total sessions run
     * - Success count and rate
     * - Failure count and rate
     * - Average session duration
     * - Total pages visited
     * - Average pages per session
     * 
     * Example:
     * const stats = tracker.getMetrics();
     * console.log(`Success rate: ${stats.successRate}%`);
     */
    public getMetrics(): {
        totalSessions: number;
        successCount: number;
        failureCount: number;
        successRate: number;
        averageDuration: number;
        totalPagesVisited: number;
        averagePagesPerSession: number;
        uptimeSeconds: number;
    } {
        const totalSessions = this.completedSessions.length;
        const successCount = this.completedSessions.filter(s => s.success).length;
        const failureCount = totalSessions - successCount;
        const successRate = totalSessions > 0
            ? (successCount / totalSessions) * 100
            : 0;

        const totalDuration = this.completedSessions.reduce(
            (sum, session) => sum + (session.duration || 0),
            0
        );
        const averageDuration = totalSessions > 0
            ? totalDuration / totalSessions
            : 0;

        const totalPagesVisited = this.completedSessions.reduce(
            (sum, session) => sum + session.pagesVisited,
            0
        );
        const averagePagesPerSession = totalSessions > 0
            ? totalPagesVisited / totalSessions
            : 0;

        const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;

        return {
            totalSessions,
            successCount,
            failureCount,
            successRate: Number(successRate.toFixed(2)),
            averageDuration: Number((averageDuration / 1000).toFixed(2)), // Convert to seconds
            totalPagesVisited,
            averagePagesPerSession: Number(averagePagesPerSession.toFixed(2)),
            uptimeSeconds: Number(uptimeSeconds.toFixed(2))
        };
    }

    /**
     * Checks if a specific proxy is currently in use
     * 
     * @param proxyIp - IP address of proxy to check
     * @returns True if proxy is in use by active session
     * 
     * Purpose: Prevent multiple sessions from using same proxy simultaneously
     * 
     * Example:
     * if (!tracker.isProxyInUse('192.168.1.1')) {
     *   // Safe to use this proxy
     * }
     */
    public isProxyInUse(proxyIp: string): boolean {
        for (const session of this.activeSessions.values()) {
            if (session.proxy.ip === proxyIp) {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns detailed summary for logging/debugging
     * 
     * @returns Formatted string with tracker state
     */
    public getSummary(): string {
        const metrics = this.getMetrics();
        return `
            SessionTracker Summary:
            - Active Sessions: ${this.getActiveCount()}
            - Completed Sessions: ${metrics.totalSessions}
            - Success Rate: ${metrics.successRate}%
            - Average Duration: ${metrics.averageDuration}s
            - Total Pages Visited: ${metrics.totalPagesVisited}
            - Uptime: ${metrics.uptimeSeconds}s
        `.trim();
    }
}