/**
 * File: src/core/browser.ts
 * 
 * Purpose: Browser automation manager using Puppeteer with stealth mode
 * Handles browser instance creation, proxy configuration, device emulation,
 * and anti-detection measures to simulate real user behavior.
 * 
 * Key Functions:
 * - createBrowser(): Launches browser with proxy and stealth settings
 * - configurePage(): Sets up page with device fingerprint and headers
 * - closeBrowser(): Safely closes browser and cleans up resources
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SessionConfig } from '../types';
import * as winston from 'winston';

// Apply stealth plugin to prevent bot detection
const puppeteerExtra = require('puppeteer-extra');
puppeteerExtra.use(StealthPlugin());

/**
 * Creates and launches a Puppeteer browser instance with proxy and stealth settings
 * 
 * @param session - Session configuration containing proxy and device details
 * @param headless - Whether to run browser in headless mode (default: true)
 * @param logger - Winston logger for debugging
 * @returns Configured browser instance
 * 
 * Features:
 * - Proxy authentication (username/password)
 * - Stealth mode (bypasses bot detection)
 * - Custom browser args for stability
 * - Device-specific configurations
 * 
 * Example:
 * const browser = await createBrowser(sessionConfig, true, logger);
 */
export async function createBrowser(
    session: SessionConfig,
    headless: boolean = true,
    logger: winston.Logger
): Promise<Browser> {
    try {
        const { proxy } = session;

        // Build browser launch arguments
        const args = [
            `--proxy-server=http://${proxy.ip}:${proxy.port}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ];

        logger.info('Launching browser', {
            sessionId: session.sessionId,
            proxy: `${proxy.ip}:${proxy.port}`,
            headless
        });

        const browser = await puppeteerExtra.launch({
            headless: headless ? 'new' : false,
            args,
            ignoreHTTPSErrors: true,
            defaultViewport: null
        });

        logger.info('Browser launched successfully', {
            sessionId: session.sessionId
        });

        return browser;
    } catch (error) {
        if (error instanceof Error) {
            logger.error('Failed to launch browser', {
                sessionId: session.sessionId,
                errorMessage: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
}

/**
 * Configures page with device fingerprint, proxy authentication, and realistic settings
 * 
 * @param page - Puppeteer page instance
 * @param session - Session configuration with device and proxy details
 * @param logger - Winston logger
 * @returns Configured page ready for navigation
 * 
 * Configuration Steps:
 * 1. Authenticate with proxy (username/password)
 * 2. Set device viewport and screen size
 * 3. Apply user agent
 * 4. Set realistic browser headers
 * 5. Enable/disable touch based on device
 * 6. Set device scale factor
 * 
 * Example:
 * const page = await browser.newPage();
 * await configurePage(page, sessionConfig, logger);
 */
export async function configurePage(
    page: Page,
    session: SessionConfig,
    logger: winston.Logger
): Promise<Page> {
    try {
        const { proxy, device } = session;

        // Authenticate with proxy
        await page.authenticate({
            username: proxy.username,
            password: proxy.password
        });

        logger.debug('Proxy authenticated', {
            sessionId: session.sessionId,
            proxy: `${proxy.ip}:${proxy.port}`
        });

        // Set viewport and device properties
        await page.setViewport({
            width: device.viewport.width,
            height: device.viewport.height,
            deviceScaleFactor: device.deviceScaleFactor,
            isMobile: device.isMobile,
            hasTouch: device.hasTouch
        });

        // Set user agent
        await page.setUserAgent(device.userAgent);

        // Set extra HTTP headers to look more realistic
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });

        // Set geolocation if available (optional enhancement)
        // This makes the simulation even more realistic
        if (proxy.city && proxy.state) {
            // Note: Actual geolocation would require coordinates
            // This is placeholder for future enhancement
            logger.debug('Geolocation context', {
                sessionId: session.sessionId,
                location: `${proxy.city}, ${proxy.state}`
            });
        }

        logger.info('Page configured successfully', {
            sessionId: session.sessionId,
            device: `${device.os} ${device.type}`,
            viewport: `${device.viewport.width}x${device.viewport.height}`
        });

        return page;
    } catch (error) {
        if (error instanceof Error) {
            logger.error('Failed to configure page', {
                sessionId: session.sessionId,
                errorMessage: error.message
            });
        }
        throw error;
    }
}

/**
 * Safely closes browser and cleans up resources
 * 
 * @param browser - Browser instance to close
 * @param sessionId - Session ID for logging
 * @param logger - Winston logger
 * 
 * Cleanup Steps:
 * 1. Close all pages
 * 2. Disconnect browser
 * 3. Close browser process
 * 4. Log cleanup completion
 * 
 * Example:
 * await closeBrowser(browser, sessionId, logger);
 */
export async function closeBrowser(
    browser: Browser,
    sessionId: string,
    logger: winston.Logger
): Promise<void> {
    try {
        const pages = await browser.pages();

        // Close all pages first
        for (const page of pages) {
            await page.close();
        }

        // Close browser
        await browser.close();

        logger.info('Browser closed successfully', {
            sessionId,
            pagesClosedCount: pages.length
        });
    } catch (error) {
        if (error instanceof Error) {
            logger.error('Error closing browser', {
                sessionId,
                errorMessage: error.message
            });
        }
        // Don't throw - we want cleanup to continue even if there's an error
    }
}

/**
 * Checks if browser is still running
 * 
 * @param browser - Browser instance to check
 * @returns True if browser is connected and running
 * 
 * Example:
 * if (isBrowserRunning(browser)) {
 *   // Continue with automation
 * }
 */
export function isBrowserRunning(browser: Browser): boolean {
    return browser.isConnected();
}