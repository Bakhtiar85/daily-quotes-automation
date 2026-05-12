/**
 * File: src/core/orchestrator.ts
 * 
 * Purpose: Main orchestration engine for running concurrent simulations
 * Manages multiple browser sessions in parallel, coordinates resource allocation,
 * and ensures smooth operation across all concurrent users.
 * 
 * Key Functions:
 * - Orchestrator class: Main controller for all simulations
 * - runSingleSession(): Executes one complete user simulation
 * - runConcurrentSessions(): Manages multiple parallel sessions
 * - start(): Entry point to begin simulation
 */

import { Browser } from 'puppeteer';
import * as winston from 'winston';
import { SessionConfig, BehaviorPattern, SimulatorConfig } from '../types';
import { SessionTracker } from './sessionTracker';
import { createBrowser, configurePage, closeBrowser } from './browser';
import { executeSession } from '../behaviors/userBehavior';
import { logSessionStart, logSessionEnd } from '../utils/logger';
import { startCleanupMonitor, stopCleanupMonitor } from '../utils/tempCleaner';

/**
 * Orchestrator class - Main simulation controller
 * 
 * Responsibilities:
 * - Manages concurrent browser sessions
 * - Coordinates proxy usage (prevents conflicts)
 * - Tracks all session metrics
 * - Handles errors and cleanup
 * - Provides progress updates
 * 
 * Example:
 * const orchestrator = new Orchestrator(config, logger);
 * await orchestrator.start(sessionConfigs);
 */
export class Orchestrator {
    private config: SimulatorConfig;
    private logger: winston.Logger;
    private tracker: SessionTracker;
    private activeBrowsers: Map<string, Browser>;
    private cleanupTimer: NodeJS.Timeout | null = null;

    /**
     * Initializes orchestrator with configuration
     * 
     * @param config - Simulator configuration
     * @param logger - Winston logger instance
     */
    constructor(config: SimulatorConfig, logger: winston.Logger) {
        this.config = config;
        this.logger = logger;
        this.tracker = new SessionTracker(logger);
        this.activeBrowsers = new Map();

        this.logger.info('Orchestrator initialized', {
            concurrentUsers: config.concurrentUsers,
            targetUrl: config.targetUrl
        });
    }

    /**
     * Runs a single user session from start to finish
     * 
     * @param session - Session configuration
     * @param behavior - Behavior pattern to follow
     * @returns Session metrics
     * 
     * Workflow:
     * 1. Launch browser with proxy
     * 2. Configure page with device fingerprint
     * 3. Execute user behavior simulation
     * 4. Collect metrics
     * 5. Clean up browser
     * 
     * Example:
     * const metrics = await runSingleSession(sessionConfig, behaviorPattern);
     */
    private async runSingleSession(
        session: SessionConfig,
        behavior: BehaviorPattern
    ): Promise<void> {
        const SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max per session

        let browser: Browser | null = null;
        let timeoutHandle: NodeJS.Timeout | undefined;
        let onDisconnected: (() => void) | undefined;

        try {
            this.tracker.addSession(session);
            logSessionStart(this.logger, session);

            browser = await createBrowser(session, this.config.headless, this.logger);
            this.activeBrowsers.set(session.sessionId, browser);

            const page = await browser.newPage();
            await configurePage(page, session, this.logger);

            // Watchdog 1: fires immediately if Chrome process crashes/disconnects
            let rejectOnDisconnect!: (err: Error) => void;
            const disconnectPromise = new Promise<never>((_, reject) => {
                rejectOnDisconnect = reject;
            });
            onDisconnected = () => {
                rejectOnDisconnect(new Error('Browser disconnected unexpectedly'));
            };
            browser.once('disconnected', onDisconnected);

            // Watchdog 2: kills the session if it exceeds the max allowed time
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`Session timed out after ${SESSION_TIMEOUT_MS / 60000} minutes`));
                }, SESSION_TIMEOUT_MS);
            });

            const metrics = await Promise.race([
                executeSession(page, this.config.targetUrl, behavior, this.logger, session.sessionId),
                disconnectPromise,
                timeoutPromise
            ]);

            logSessionEnd(this.logger, metrics);
            this.tracker.removeSession(session.sessionId, metrics);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.logger.error('Session failed — killing browser', {
                sessionId: session.sessionId,
                errorMessage
            });

            // Force kill the process so a frozen browser does not block the finally cleanup
            if (browser) {
                try { browser.process()?.kill(); } catch { /* already dead */ }
            }

            this.tracker.removeSession(session.sessionId, {
                sessionId: session.sessionId,
                startTime: session.startTime,
                endTime: new Date(),
                duration: Date.now() - session.startTime.getTime(),
                pagesVisited: 0,
                actionsPerformed: [],
                success: false,
                errorMessage
            });

        } finally {
            // Always clean up regardless of how the session ended
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (browser && onDisconnected) browser.off('disconnected', onDisconnected);
            if (browser) {
                await closeBrowser(browser, session.sessionId, this.logger);
                this.activeBrowsers.delete(session.sessionId);
            }
        }
    }

    /**
     * Runs multiple sessions concurrently in parallel
     * 
     * @param sessions - Array of session configurations
     * @param behavior - Behavior pattern for all sessions
     * 
     * Concurrency Strategy:
     * - Launches all sessions simultaneously using Promise.all
     * - Each session runs independently
     * - Errors in one session don't affect others
     * - All sessions complete before returning
     * 
     * Example:
     * await orchestrator.runConcurrentSessions(sessionConfigs, behaviorPattern);
     */
    private async runConcurrentSessions(
        sessions: SessionConfig[],
        behavior: BehaviorPattern
    ): Promise<void> {
        this.logger.info('Starting staggered sessions', {
            sessionCount: sessions.length
        });

        // Shuffle sessions for random order
        const shuffledSessions = [...sessions].sort(() => Math.random() - 0.5);

        // Launch sessions with random delays
        const sessionPromises: Promise<void>[] = [];

        for (let i = 0; i < shuffledSessions.length; i++) {
            const session = shuffledSessions[i];

            // Random delay between 5-30 seconds before launching each session
            const delaySeconds = Math.floor(Math.random() * 26) + 5; // 5-30 seconds

            this.logger.info(`Scheduling session ${i + 1}/${shuffledSessions.length}`, {
                username: session.user.username,
                delaySeconds
            });

            // Launch after delay (but don't wait - fire and forget)
            const promise = (async () => {
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
                await this.runSingleSession(session, behavior);
            })();

            sessionPromises.push(promise);
        }

        // allSettled — one session rejecting can never cancel the rest of the batch
        await Promise.allSettled(sessionPromises);

        this.logger.info('All staggered sessions completed');
    }

    /**
     * Main entry point to start simulation
     * 
     * @param sessions - Array of session configurations to run
     * 
     * Features:
     * - Runs sessions concurrently
     * - Logs progress and metrics
     * - Handles graceful shutdown
     * - Provides final summary
     * 
     * Example:
     * await orchestrator.start(sessionConfigs);
     */
    public async start(sessions: SessionConfig[]): Promise<void> {
        const startTime = new Date();

        this.logger.info('Simulation started', {
            totalSessions: sessions.length,
            startTime: startTime.toISOString()
        });

        this.cleanupTimer = startCleanupMonitor(
            () => new Set(this.activeBrowsers.keys()),
            this.logger
        );

        try {
            // Run all sessions
            await this.runConcurrentSessions(sessions, this.config.defaultBehavior);

            // Calculate final metrics
            const metrics = this.tracker.getMetrics();
            const endTime = new Date();
            const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000;

            // Log summary
            this.logger.info('Simulation completed successfully', {
                totalDuration: `${totalDuration.toFixed(2)}s`,
                ...metrics
            });

            console.log('\n' + '='.repeat(60));
            console.log('SIMULATION SUMMARY');
            console.log('='.repeat(60));
            console.log(this.tracker.getSummary());
            console.log('='.repeat(60) + '\n');

        } catch (error) {
            this.logger.error('Simulation failed', {
                errorMessage: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        } finally {
            if (this.cleanupTimer) {
                stopCleanupMonitor(this.cleanupTimer);
                this.cleanupTimer = null;
            }
        }
    }

    /**
     * Returns current tracker instance for external access
     * 
     * @returns SessionTracker instance
     */
    public getTracker(): SessionTracker {
        return this.tracker;
    }

    /**
     * Gracefully shuts down all active browsers
     * 
     * Use Case: Emergency shutdown or cleanup
     * 
     * Example:
     * await orchestrator.shutdown();
     */
    public async shutdown(): Promise<void> {
        this.logger.warn('Initiating shutdown...');

        if (this.cleanupTimer) {
            stopCleanupMonitor(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        const closePromises = Array.from(this.activeBrowsers.entries()).map(
            async ([sessionId, browser]) => {
                await closeBrowser(browser, sessionId, this.logger);
            }
        );

        await Promise.all(closePromises);
        this.activeBrowsers.clear();

        this.logger.info('Shutdown complete');
    }
}