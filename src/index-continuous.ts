/**
 * File: src/index-continuous.ts
 * 
 * Purpose: True continuous traffic with overlapping sessions
 * Maintains constant active users by starting new sessions
 * as soon as slots become available
 */

import * as path from 'path';
import { validateAndLoadConfig } from './config/loader';
import { createSessionPairs } from './config/matcher';
import { createLogger } from './utils/logger';
import { Orchestrator } from './core/orchestrator';
import { SimulatorConfig } from './types';
import 'dotenv/config';

const SIMULATOR_CONFIG: SimulatorConfig = {
    concurrentUsers: parseInt(process.env.CONCURRENT_USERS || '5'),
    targetUrl: process.env.TARGET_URL || 'https://daily-quotes-blond.vercel.app/',
    proxyListPath: path.join(__dirname, '../config/proxies.json'),
    userListPath: path.join(__dirname, '../config/users.json'),
    deviceConfigsPath: path.join(__dirname, '../config/devices.json'),
    logDirectory: path.join(__dirname, '../logs'),
    headless: process.env.HEADLESS === 'true',
    defaultBehavior: {
        minScrollDepth: parseInt(process.env.MIN_SCROLL_DEPTH || '40'),
        maxScrollDepth: parseInt(process.env.MAX_SCROLL_DEPTH || '90'),
        minTimeOnPage: parseInt(process.env.MIN_TIME_ON_PAGE || '10'),
        maxTimeOnPage: parseInt(process.env.MAX_TIME_ON_PAGE || '45'),
        clickRandomQuote: parseFloat(process.env.CLICK_RANDOM_QUOTE_PROBABILITY || '0.7') > 0,
        readStory: parseFloat(process.env.READ_STORY_PROBABILITY || '0.6') > 0,
        visitMultiplePages: process.env.VISIT_MULTIPLE_PAGES === 'true',
        maxPagesToVisit: parseInt(process.env.MAX_PAGES_TO_VISIT || '2')
    }
};

// Dynamic traffic configuration
const CONTINUOUS_CONFIG = {
    minActiveUsers: parseInt(process.env.MIN_ACTIVE_USERS || '2'),
    maxActiveUsers: parseInt(process.env.MAX_ACTIVE_USERS || '8'),
    sessionStartDelay: parseInt(process.env.SESSION_START_DELAY || '10') * 1000,
    // Peak hours (24-hour format)
    peakHoursStart: parseInt(process.env.PEAK_HOURS_START || '9'),  // 9 AM
    peakHoursEnd: parseInt(process.env.PEAK_HOURS_END || '21'),     // 9 PM
    // Adjustment interval (how often to recalculate target users)
    adjustmentInterval: 5 * 60 * 1000 // 5 minutes
};


/**
 * Calculates target active users based on time of day
 */
function getTargetActiveUsers(): number {
    const now = new Date();
    const currentHour = now.getHours();

    // Check if in peak hours
    const isPeakHours = currentHour >= CONTINUOUS_CONFIG.peakHoursStart &&
        currentHour < CONTINUOUS_CONFIG.peakHoursEnd;

    let baseTarget: number;

    if (isPeakHours) {
        // Peak hours: 60-100% of max users
        const peakMin = Math.ceil(CONTINUOUS_CONFIG.maxActiveUsers * 0.6);
        baseTarget = Math.floor(Math.random() * (CONTINUOUS_CONFIG.maxActiveUsers - peakMin + 1)) + peakMin;
    } else {
        // Off-peak: 30-60% of max users
        const offPeakMax = Math.ceil(CONTINUOUS_CONFIG.maxActiveUsers * 0.6);
        const offPeakMin = Math.ceil(CONTINUOUS_CONFIG.maxActiveUsers * 0.3);
        baseTarget = Math.floor(Math.random() * (offPeakMax - offPeakMin + 1)) + offPeakMin;
    }

    // Ensure within bounds
    return Math.max(
        CONTINUOUS_CONFIG.minActiveUsers,
        Math.min(CONTINUOUS_CONFIG.maxActiveUsers, baseTarget)
    );
}

/**
 * Gets random variation (-1, 0, or +1) to add natural fluctuation
 */
function getRandomVariation(): number {
    const rand = Math.random();
    if (rand < 0.3) return -1;
    if (rand > 0.7) return 1;
    return 0;
}

class ContinuousOrchestrator {
    private config: SimulatorConfig;
    private logger: any;
    private activeSessionCount: number = 0;
    private totalSessionsRun: number = 0;
    private isShuttingDown: boolean = false;
    private proxies: any[];
    private users: any[];
    private devices: any[];
    private targetActiveUsers: number = CONTINUOUS_CONFIG.minActiveUsers;
    private adjustmentTimer: NodeJS.Timeout | null = null;

    constructor(
        config: SimulatorConfig,
        logger: any,
        proxies: any[],
        users: any[],
        devices: any[]
    ) {
        this.config = config;
        this.logger = logger;
        this.proxies = proxies;
        this.users = users;
        this.devices = devices;
        this.targetActiveUsers = getTargetActiveUsers();
    }

    /**
     * Periodically adjusts target user count
     */
    private startDynamicAdjustment(): void {
        this.adjustmentTimer = setInterval(() => {
            if (this.isShuttingDown) return;

            const oldTarget = this.targetActiveUsers;
            const newBaseTarget = getTargetActiveUsers();
            const variation = getRandomVariation();

            this.targetActiveUsers = Math.max(
                CONTINUOUS_CONFIG.minActiveUsers,
                Math.min(CONTINUOUS_CONFIG.maxActiveUsers, newBaseTarget + variation)
            );

            if (oldTarget !== this.targetActiveUsers) {
                this.logger.info('Adjusting target users', {
                    oldTarget,
                    newTarget: this.targetActiveUsers,
                    currentActive: this.activeSessionCount,
                    hour: new Date().getHours()
                });

                console.log(
                    `\n📊 Target users adjusted: ${oldTarget} → ${this.targetActiveUsers} ` +
                    `(Currently active: ${this.activeSessionCount})\n`
                );

                // If new target is higher, start more sessions
                const deficit = this.targetActiveUsers - this.activeSessionCount;
                if (deficit > 0) {
                    for (let i = 0; i < deficit; i++) {
                        setTimeout(() => this.startNewSession(), i * 2000); // Stagger by 2s
                    }
                }
                // If lower, sessions will naturally complete without being replaced
            }
        }, CONTINUOUS_CONFIG.adjustmentInterval);
    }

    /**
     * Runs a single session and decrements counter when done
     */
    private async runSession(sessionNumber: number): Promise<void> {
        this.activeSessionCount++;

        try {
            const sessions = await createSessionPairs(
                this.users,
                this.proxies,
                this.devices,
                1
            );

            if (sessions.length === 0) {
                this.logger.warn('No sessions created');
                return;
            }

            const session = sessions[0];

            this.logger.info('Starting continuous session', {
                sessionNumber,
                activeCount: this.activeSessionCount,
                targetCount: this.targetActiveUsers,
                username: session.user.username,
                city: session.proxy.city,
                device: `${session.device.os} ${session.device.type}`,
                trafficSource: session.trafficSource.name
            });

            console.log(
                `🚀 Session #${sessionNumber}: ${session.user.username} -> ` +
                `${session.proxy.city} -> ${session.device.os} ${session.device.type} -> ` +
                `${session.trafficSource.name} (Active: ${this.activeSessionCount}/${this.targetActiveUsers})`
            );

            const orchestrator = new Orchestrator(this.config, this.logger);
            await orchestrator.start([session]);

            this.totalSessionsRun++;

            this.logger.info('Continuous session completed', {
                sessionNumber,
                totalCompleted: this.totalSessionsRun
            });

        } catch (error) {
            this.logger.error('Session failed', {
                sessionNumber,
                error: error instanceof Error ? error.message : 'Unknown'
            });
        } finally {
            this.activeSessionCount--;

            // Only start new session if below target
            if (!this.isShuttingDown && this.activeSessionCount < this.targetActiveUsers) {
                this.startNewSession();
            }
        }
    }

    /**
     * Starts a new session with small delay
     */
    private async startNewSession(): Promise<void> {
        this.totalSessionsRun++;

        // Random delay between sessions (10-30 seconds)
        const delay = Math.floor(Math.random() * 20000) + 10000;
        await new Promise(resolve => setTimeout(resolve, delay));

        if (!this.isShuttingDown) {
            this.runSession(this.totalSessionsRun).catch(err => {
                this.logger.error('Failed to start session', { error: err.message });
            });
        }
    }

    /**
     * Starts continuous traffic with dynamic adjustment
     */
    public async start(): Promise<void> {
        console.log('\n🔄 Starting dynamic continuous traffic mode...');
        console.log(`📊 User range: ${CONTINUOUS_CONFIG.minActiveUsers}-${CONTINUOUS_CONFIG.maxActiveUsers} concurrent users`);
        console.log(`⏰ Peak hours: ${CONTINUOUS_CONFIG.peakHoursStart}:00 - ${CONTINUOUS_CONFIG.peakHoursEnd}:00`);
        console.log(`🎯 Current target: ${this.targetActiveUsers} users\n`);

        // Start dynamic adjustment
        this.startDynamicAdjustment();

        // Start initial batch
        for (let i = 0; i < this.targetActiveUsers; i++) {
            await new Promise(resolve => setTimeout(resolve, CONTINUOUS_CONFIG.sessionStartDelay));
            this.startNewSession();
        }

        // Keep process alive
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.isShuttingDown && this.activeSessionCount === 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Graceful shutdown
     */
    public async shutdown(): Promise<void> {
        this.isShuttingDown = true;

        // Stop adjustment timer
        if (this.adjustmentTimer) {
            clearInterval(this.adjustmentTimer);
        }

        console.log('\n⚠️  Shutting down continuous mode...');
        console.log(`⏳ Waiting for ${this.activeSessionCount} active sessions to complete...\n`);

        const maxWait = 300000;
        const startWait = Date.now();

        while (this.activeSessionCount > 0 && (Date.now() - startWait) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('✅ Continuous mode stopped');
        console.log(`📊 Total sessions run: ${this.totalSessionsRun}\n`);
    }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('CONTINUOUS TRAFFIC SIMULATOR - DYNAMIC MODE');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toLocaleString()}`);
    console.log(`Target: ${SIMULATOR_CONFIG.targetUrl}`);
    console.log(`Headless: ${SIMULATOR_CONFIG.headless}`);
    console.log('='.repeat(60) + '\n');

    const logger = createLogger(SIMULATOR_CONFIG.logDirectory);
    logger.info('Dynamic continuous mode started');

    // Load configurations
    const { proxies, users, devices } = validateAndLoadConfig(
        SIMULATOR_CONFIG.proxyListPath,
        SIMULATOR_CONFIG.userListPath,
        SIMULATOR_CONFIG.deviceConfigsPath
    );

    const orchestrator = new ContinuousOrchestrator(
        SIMULATOR_CONFIG,
        logger,
        proxies,
        users,
        devices
    );

    // Graceful shutdown
    const shutdown = async () => {
        await orchestrator.shutdown();
        logger.info('Application shutdown complete');
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Start continuous traffic
    await orchestrator.start();
}

// Run the application
main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});