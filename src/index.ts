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
  // Number of concurrent users to simulate
  concurrentUsers: 5,
  
  // Target website URL
  targetUrl: 'https://your-quotes-website.vercel.app', // TODO: Replace with your actual URL
  
  // Config file paths
  proxyListPath: path.join(__dirname, '../config/proxies.json'),
  userListPath: path.join(__dirname, '../config/users.json'),
  deviceConfigsPath: path.join(__dirname, '../config/devices.json'),
  
  // Log directory
  logDirectory: path.join(__dirname, '../logs'),
  
  // Browser settings
  headless: true, // Set to false to see browsers in action
  
  // Default user behavior pattern
  defaultBehavior: {
    minScrollDepth: 40,      // Scroll at least 40% down
    maxScrollDepth: 90,      // Scroll at most 90% down
    minTimeOnPage: 10,       // Minimum 10 seconds per page
    maxTimeOnPage: 45,       // Maximum 45 seconds per page
    clickRandomQuote: true,  // 70% chance to click random quote
    readStory: true,         // 60% chance to read story
    visitMultiplePages: true, // Enable multi-page visits
    maxPagesToVisit: 2       // Visit up to 2 additional pages
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
        `${session.device.os} ${session.device.type}`
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