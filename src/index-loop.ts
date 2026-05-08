/**
 * File: src/index-loop.ts
 * 
 * Purpose: Continuous simulation with random delays for production
 * Runs indefinitely until manually stopped (Ctrl+C or PM2 stop)
 */

import 'dotenv/config';
import * as path from 'path';
import { validateAndLoadConfig } from './config/loader';
import { createSessionPairs } from './config/matcher';
import { createLogger, logMetrics } from './utils/logger';
import { Orchestrator } from './core/orchestrator';
import { SimulatorConfig } from './types';

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

// Loop configuration with random delays
const LOOP_CONFIG = {
    minDelayMinutes: parseInt(process.env.MIN_DELAY_BETWEEN_BATCHES || '3'),
    maxDelayMinutes: parseInt(process.env.MAX_DELAY_BETWEEN_BATCHES || '10'),
    runIndefinitely: true
};

/**
 * Generates random delay in milliseconds
 */
function getRandomDelay(): number {
    const minMs = LOOP_CONFIG.minDelayMinutes * 60 * 1000;
    const maxMs = LOOP_CONFIG.maxDelayMinutes * 60 * 1000;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

/**
 * Runs a single batch of simulations
 */
async function runSimulationBatch(
    batchNumber: number,
    configs: { proxies: any[], users: any[], devices: any[] },
    logger: any
): Promise<void> {
    const batchStartTime = new Date();

    console.log('\n' + '='.repeat(60));
    console.log(`BATCH #${batchNumber} - ${batchStartTime.toLocaleString()}`);
    console.log('='.repeat(60) + '\n');

    logger.info('Starting batch', {
        batchNumber,
        timestamp: batchStartTime.toISOString()
    });

    const sessions = await createSessionPairs(
        configs.users,
        configs.proxies,
        configs.devices,
        SIMULATOR_CONFIG.concurrentUsers
    );

    console.log(`✓ Created ${sessions.length} sessions for batch ${batchNumber}\n`);

    const orchestrator = new Orchestrator(SIMULATOR_CONFIG, logger);
    await orchestrator.start(sessions);

    const metrics = orchestrator.getTracker().getMetrics();
    const batchEndTime = new Date();
    const batchDuration = (batchEndTime.getTime() - batchStartTime.getTime()) / 1000;

    logMetrics(logger, {
        batch: batchNumber,
        totalSessions: metrics.totalSessions,
        successRate: metrics.successRate,
        batchDuration: `${batchDuration.toFixed(2)}s`,
        timestamp: batchEndTime.toISOString()
    });

    logger.info('Batch completed', {
        batchNumber,
        metrics,
        duration: batchDuration
    });
}

/**
 * Main continuous loop
 */
async function main(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('CONTINUOUS TRAFFIC SIMULATOR - PRODUCTION MODE');
    console.log('='.repeat(60));
    console.log(`Started: ${new Date().toLocaleString()}`);
    console.log(`Random delay: ${LOOP_CONFIG.minDelayMinutes}-${LOOP_CONFIG.maxDelayMinutes} minutes`);
    console.log(`Concurrent users: ${SIMULATOR_CONFIG.concurrentUsers}`);
    console.log(`Target: ${SIMULATOR_CONFIG.targetUrl}`);
    console.log(`Headless: ${SIMULATOR_CONFIG.headless}`);
    console.log('='.repeat(60) + '\n');

    const logger = createLogger(SIMULATOR_CONFIG.logDirectory);
    logger.info('Continuous mode started', {
        config: LOOP_CONFIG,
        simulator: SIMULATOR_CONFIG
    });

    // Load configurations once
    const configs = validateAndLoadConfig(
        SIMULATOR_CONFIG.proxyListPath,
        SIMULATOR_CONFIG.userListPath,
        SIMULATOR_CONFIG.deviceConfigsPath
    );

    let batchNumber = 1;
    let isShuttingDown = false;

    // Graceful shutdown handler
    const shutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log('\n\n⚠️  Received shutdown signal. Finishing current batch...');
        logger.warn('Shutdown initiated', { batchNumber });

        // Give current batch time to finish (max 2 minutes)
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✅ Shutdown complete\n');
        logger.info('Shutdown complete', {
            totalBatches: batchNumber - 1,
            timestamp: new Date().toISOString()
        });

        process.exit(0);
    };

    // Register shutdown handlers
    process.on('SIGINT', shutdown);  // Ctrl+C
    process.on('SIGTERM', shutdown); // PM2 stop

    // Infinite loop
    while (LOOP_CONFIG.runIndefinitely && !isShuttingDown) {
        try {
            await runSimulationBatch(batchNumber, configs, logger);

            if (!isShuttingDown) {
                const delayMs = getRandomDelay();
                const delayMinutes = (delayMs / 60000).toFixed(1);
                const nextBatchTime = new Date(Date.now() + delayMs);

                console.log(`\n⏳ Waiting ${delayMinutes} minutes before next batch...`);
                console.log(`📅 Next batch at: ${nextBatchTime.toLocaleString()}\n`);

                logger.info('Waiting for next batch', {
                    delayMinutes: parseFloat(delayMinutes),
                    nextBatchTime: nextBatchTime.toISOString()
                });

                await new Promise(resolve => setTimeout(resolve, delayMs));
            }

            batchNumber++;
        } catch (error) {
            logger.error('Batch failed', {
                batchNumber,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            console.error(`\n❌ Batch ${batchNumber} failed:`, error);
            console.log('⚠️  Continuing to next batch...\n');

            // Wait 1 minute before retry on error
            await new Promise(resolve => setTimeout(resolve, 60000));
            batchNumber++;
        }
    }
}

main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});