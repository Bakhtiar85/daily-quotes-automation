/**
 * File: src/index.ts
 * 
 * Purpose: Main entry point for the traffic simulation system
 * Coordinates all components: config loading, session creation, and orchestration.
 * This is the file you run to start the entire simulation.
 * 
 * Workflow:
 * 1. Load configuration files (proxies, users, devices)
 * 2. Create session pairs (user + proxy + device)
 * 3. Initialize logger and orchestrator
 * 4. Run concurrent simulations
 * 5. Display final metrics
 * 
 * Usage:
 * npm run dev  (development mode)
 * npm start    (production mode)
 */

import 'dotenv/config';
import * as path from 'path';
import { validateAndLoadConfig } from './config/loader';
import { createSessionPairs } from './config/matcher';
import { createLogger, logMetrics } from './utils/logger';
import { Orchestrator } from './core/orchestrator';
import { SimulatorConfig } from './types';

/**
 * Main application configuration
 * Defines all runtime parameters for the simulation
 */
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

/**
 * Main execution function
 * Runs the complete simulation from start to finish
 * 
 * Steps:
 * 1. Initialize logger
 * 2. Load and validate configurations
 * 3. Create session pairs
 * 4. Initialize orchestrator
 * 5. Run simulation
 * 6. Display results
 */
async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('DAILY QUOTES TRAFFIC SIMULATOR');
  console.log('='.repeat(60) + '\n');

  // Initialize logger
  const logger = createLogger(SIMULATOR_CONFIG.logDirectory);
  logger.info('Application started');

  try {
    // Step 1: Load configurations
    console.log('📁 Loading configuration files...');
    const { proxies, users, devices } = validateAndLoadConfig(
      SIMULATOR_CONFIG.proxyListPath,
      SIMULATOR_CONFIG.userListPath,
      SIMULATOR_CONFIG.deviceConfigsPath
    );

    // Step 2: Create session pairs
    console.log(`\n👥 Creating ${SIMULATOR_CONFIG.concurrentUsers} session configurations...`);
    const sessions = createSessionPairs(
      users,
      proxies,
      devices,
      SIMULATOR_CONFIG.concurrentUsers
    );

    console.log(`✓ Created ${sessions.length} valid sessions\n`);

    // Display session preview
    console.log('Session Preview:');
    sessions.forEach((session, index) => {
      console.log(
        `  ${index + 1}. ${session.user.username} -> ` +
        `${session.proxy.city} (${session.proxy.ip}) -> ` +
        `${session.device.os} ${session.device.type} -> ` +
        `${session.trafficSource.name}`  // ADD THIS LINE
      );
    });

    console.log('\n' + '='.repeat(60));
    console.log('🚀 Starting simulation...');
    console.log('='.repeat(60) + '\n');

    // Step 3: Initialize and run orchestrator
    const orchestrator = new Orchestrator(SIMULATOR_CONFIG, logger);

    // Handle graceful shutdown on Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\n\n⚠️  Received interrupt signal. Shutting down gracefully...');
      await orchestrator.shutdown();
      process.exit(0);
    });

    // Run simulation
    await orchestrator.start(sessions);

    // Step 4: Final metrics
    const finalMetrics = orchestrator.getTracker().getMetrics();

    logMetrics(logger, {
      totalSessions: finalMetrics.totalSessions,
      successRate: finalMetrics.successRate,
      avgDuration: finalMetrics.averageDuration,
      totalPages: finalMetrics.totalPagesVisited
    });

    console.log('\n✅ Simulation completed successfully!\n');
    console.log(`📊 Check logs at: ${SIMULATOR_CONFIG.logDirectory}\n`);

  } catch (error) {
    if (error instanceof Error) {
      logger.error('Application error', {
        errorMessage: error.message,
        stack: error.stack
      });

      console.error('\n❌ Simulation failed:', error.message);
      console.error('\nCheck logs for details:', SIMULATOR_CONFIG.logDirectory);
    }

    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});