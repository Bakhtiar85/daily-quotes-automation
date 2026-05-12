/**
 * File: src/behaviors/userBehavior.ts
 * 
 * Purpose: Simulates realistic human behavior patterns on the website
 * Implements scrolling, reading, clicking, and navigation actions that
 * mimic real user interactions with natural timing and randomness.
 * 
 * Key Functions:
 * - simulateReading(): Waits for realistic reading time based on content length
 * - scrollPage(): Performs smooth scrolling with random patterns
 * - clickRandomQuote(): Simulates clicking the "Random Quote" button
 * - readStory(): Scrolls to and reads the story section
 * - visitPage(): Navigates to a page and performs realistic actions
 */

import { Page } from 'puppeteer';
import { BehaviorPattern, SessionMetrics } from '../types';
import * as winston from 'winston';

/**
 * Generates random delay between min and max milliseconds
 * 
 * @param min - Minimum delay in milliseconds
 * @param max - Maximum delay in milliseconds
 * @returns Random delay duration
 * 
 * Purpose: Creates natural timing variations to mimic human behavior
 * 
 * Example:
 * await page.waitForTimeout(randomDelay(1000, 3000)); // Wait 1-3 seconds
 */
function randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Simulates realistic reading time based on content length
 * 
 * @param page - Puppeteer page instance
 * @param selector - CSS selector of element to "read"
 * @param logger - Winston logger
 * @returns Promise that resolves after reading time
 * 
 * Algorithm:
 * - Counts words in element
 * - Assumes average reading speed of 200-250 words per minute
 * - Adds random variation (±20%)
 * 
 * Example:
 * await simulateReading(page, '.quote-text', logger);
 */
async function simulateReading(
    page: Page,
    selector: string,
    logger: winston.Logger
): Promise<void> {
    try {
        const textContent = await page.$eval(selector, el => el.textContent || '');
        const wordCount = textContent.split(/\s+/).length;

        // Average reading speed: 200-250 words per minute
        const baseReadingTime = (wordCount / 225) * 60 * 1000; // milliseconds

        // Add randomness (±20%)
        const variation = baseReadingTime * 0.2;
        const readingTime = baseReadingTime + randomDelay(-variation, variation);

        logger.debug('Simulating reading', {
            wordCount,
            readingTimeSeconds: (readingTime / 1000).toFixed(2)
        });

        await page.waitForTimeout(readingTime);
    } catch (error) {
        // Element might not exist, use default timing
        logger.debug('Reading element not found, using default time');
        await page.waitForTimeout(randomDelay(2000, 5000));
    }
}

/**
 * Performs smooth scrolling with random patterns to mimic human behavior
 * 
 * @param page - Puppeteer page instance
 * @param scrollDepthPercent - How far down the page to scroll (0-100)
 * @param logger - Winston logger
 * 
 * Behavior:
 * - Scrolls in multiple small increments (not instant jump)
 * - Random pause between scroll actions
 * - Variable scroll speeds
 * - Occasional "back-scroll" (reading something again)
 * 
 * Example:
 * await scrollPage(page, 80, logger); // Scroll 80% down the page
 */
function isContextDestroyed(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.includes('context was destroyed') ||
        error.message.includes('Target closed') ||
        error.message.includes('Session closed');
}

export async function scrollPage(
    page: Page,
    scrollDepthPercent: number,
    logger: winston.Logger
): Promise<void> {
    try {
        const pageHeight = await page.evaluate(() => document.body.scrollHeight);
        const targetScroll = (pageHeight * scrollDepthPercent) / 100;

        // Scroll in increments to look natural
        const scrollSteps = Math.floor(Math.random() * 5) + 3; // 3-7 steps
        const scrollIncrement = targetScroll / scrollSteps;

        logger.debug('Starting scroll simulation', {
            pageHeight,
            targetScroll,
            scrollSteps
        });

        for (let i = 0; i < scrollSteps; i++) {
            const scrollTo = scrollIncrement * (i + 1);

            try {
                await page.evaluate((y) => {
                    window.scrollTo({
                        top: y,
                        behavior: 'smooth'
                    });
                }, scrollTo);

                // Random pause between scrolls (0.5-2 seconds)
                await page.waitForTimeout(randomDelay(500, 2000));

                // Occasionally scroll back up a bit (25% chance)
                if (Math.random() < 0.25 && i > 0) {
                    await page.evaluate(() => {
                        window.scrollBy({
                            top: -100,
                            behavior: 'smooth'
                        });
                    });
                    await page.waitForTimeout(randomDelay(300, 800));
                }
            } catch (stepError) {
                if (isContextDestroyed(stepError)) {
                    logger.debug('Scroll interrupted — page navigated mid-scroll');
                    return;
                }
                throw stepError;
            }
        }

        logger.debug('Scroll completed', { finalDepth: scrollDepthPercent });
    } catch (error) {
        if (isContextDestroyed(error)) {
            logger.debug('Scroll interrupted — page navigated');
            return;
        }
        if (error instanceof Error) {
            logger.error('Scroll simulation failed', {
                errorMessage: error.message
            });
        }
    }
}

/**
 * Simulates clicking the "Random Quote" button
 * 
 * @param page - Puppeteer page instance
 * @param logger - Winston logger
 * @returns True if click was successful, false otherwise
 * 
 * Steps:
 * 1. Wait for button to be visible
 * 2. Simulate mouse movement to button
 * 3. Small random delay (thinking time)
 * 4. Click button
 * 5. Wait for page to update
 * 
 * Example:
 * const clicked = await clickRandomQuote(page, logger);
 */
// Performs a click then checks if a new tab/window opened within 2 seconds.
// If one did, simulates a brief visit and closes it before returning.
async function clickAndHandleNewTab(
    page: Page,
    clickFn: () => Promise<void>,
    logger: winston.Logger
): Promise<void> {
    const browser = page.browser();

    let newTabResolve: (p: Page) => void;
    const newTabPromise = new Promise<Page>(resolve => { newTabResolve = resolve; });

    const onTarget = async (target: import('puppeteer').Target) => {
        const newPage = await target.page();
        if (newPage) newTabResolve(newPage);
    };

    browser.once('targetcreated', onTarget);

    await clickFn();

    const newPage = await Promise.race([
        newTabPromise,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 2000))
    ]);

    browser.off('targetcreated', onTarget);

    if (newPage) {
        logger.debug('New tab detected — simulating brief visit');
        try {
            await new Promise(resolve => setTimeout(resolve, randomDelay(2000, 5000)));
            await newPage.close();
            logger.debug('New tab closed');
        } catch {
            // tab may have closed itself
        }
    }
}

export async function clickRandomQuote(
    page: Page,
    logger: winston.Logger
): Promise<boolean> {
    try {
        await page.waitForSelector('button', { timeout: 5000 });

        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent?.toLowerCase() ?? '');
            if (text.includes('random')) {
                await clickAndHandleNewTab(page, () => btn.click(), logger);
                logger.debug('Clicked random quote button');
                await page.waitForTimeout(randomDelay(1000, 2000));
                return true;
            }
        }

        return false;
    } catch (error) {
        if (error instanceof Error) {
            logger.debug('Could not click random quote button', {
                errorMessage: error.message
            });
        }
        return false;
    }
}

/**
 * Simulates reading the story section
 * 
 * @param page - Puppeteer page instance
 * @param logger - Winston logger
 * @returns True if story was read, false otherwise
 * 
 * Steps:
 * 1. Click "Read Story" button
 * 2. Wait for smooth scroll to story section
 * 3. Read story content (based on length)
 * 4. Scroll through story
 * 
 * Example:
 * const storyRead = await readStory(page, logger);
 */
export async function readStory(
    page: Page,
    logger: winston.Logger
): Promise<boolean> {
    try {
        // Look for "Read Story" button
        const buttons = await page.$$('button');
        let storyButtonClicked = false;
        for (const btn of buttons) {
            const text = await btn.evaluate(el => el.textContent?.toLowerCase() ?? '');
            if (text.includes('story')) {
                await clickAndHandleNewTab(page, () => btn.click(), logger);
                storyButtonClicked = true;
                break;
            }
        }

        if (storyButtonClicked) {
            logger.debug('Clicked read story button');

            // Wait for scroll animation
            await page.waitForTimeout(randomDelay(1500, 2500));

            // Read the story content
            await simulateReading(page, 'section', logger);

            // Scroll through story section
            await scrollPage(page, randomDelay(60, 90), logger);

            return true;
        }

        return false;
    } catch (error) {
        if (error instanceof Error) {
            logger.debug('Could not read story', {
                errorMessage: error.message
            });
        }
        return false;
    }
}

/**
 * Simulates random mouse movements across the page
 */
async function simulateMouseMovement(
    page: Page,
    logger: winston.Logger
): Promise<void> {
    try {
        const viewport = page.viewport();
        if (!viewport) return;

        // Random mouse movements (3-7 movements)
        const movements = Math.floor(Math.random() * 5) + 3;

        for (let i = 0; i < movements; i++) {
            const x = Math.floor(Math.random() * viewport.width);
            const y = Math.floor(Math.random() * viewport.height);

            await page.mouse.move(x, y);
            await page.waitForTimeout(randomDelay(100, 500));
        }

        logger.debug('Mouse movements completed', { movements });
    } catch (error) {
        logger.debug('Mouse movement failed');
    }
}

/**
 * Selects random text on the page
 */
async function selectRandomText(
    page: Page,
    logger: winston.Logger
): Promise<boolean> {
    try {
        const textSelected = await page.evaluate(() => {
            const textElements = Array.from(document.querySelectorAll('p, blockquote, span, div'));
            const elementsWithText = textElements.filter(el =>
                el.textContent && el.textContent.trim().length > 20
            );

            if (elementsWithText.length === 0) return false;

            const randomElement = elementsWithText[
                Math.floor(Math.random() * elementsWithText.length)
            ];

            const range = document.createRange();
            const selection = window.getSelection();

            if (!selection || !randomElement.firstChild) return false;

            range.selectNodeContents(randomElement.firstChild);
            selection.removeAllRanges();
            selection.addRange(range);

            return true;
        });

        if (textSelected) {
            logger.debug('Text selected');
            await page.waitForTimeout(randomDelay(1000, 3000));

            // Deselect
            await page.evaluate(() => {
                const selection = window.getSelection();
                if (selection) selection.removeAllRanges();
            });
        }

        return textSelected;
    } catch (error) {
        logger.debug('Text selection failed');
        return false;
    }
}

/**
 * Randomly clicks on non-interactive elements (not buttons/links)
 */
async function randomPageClick(
    page: Page,
    logger: winston.Logger
): Promise<boolean> {
    try {
        const elements = await page.$$('div, section, article, p');
        if (elements.length === 0) return false;

        const randomElement = elements[Math.floor(Math.random() * elements.length)];
        await clickAndHandleNewTab(page, () => randomElement.click(), logger);
        logger.debug('Random click performed');
        await page.waitForTimeout(randomDelay(300, 800));
        return true;
    } catch (error) {
        logger.debug('Random click failed');
        return false;
    }
}

/**
 * Hovers over random elements
 */
async function hoverOverElements(
    page: Page,
    logger: winston.Logger
): Promise<void> {
    try {
        const elements = await page.$$('button, a, .card, img');

        if (elements.length === 0) return;

        // Hover over 1-3 random elements
        const hoverCount = Math.min(Math.floor(Math.random() * 3) + 1, elements.length);

        for (let i = 0; i < hoverCount; i++) {
            const randomElement = elements[Math.floor(Math.random() * elements.length)];

            try {
                await randomElement.hover();
                await page.waitForTimeout(randomDelay(500, 1500));
            } catch {
                // Element might not be hoverable
            }
        }

        logger.debug('Hover actions completed', { hoverCount });
    } catch (error) {
        logger.debug('Hover failed');
    }
}

/**
 * Executes complete user behavior pattern on a page
 * 
 * @param page - Puppeteer page instance
 * @param url - URL to visit
 * @param behavior - Behavior pattern configuration
 * @param logger - Winston logger
 * @param sessionId - Session ID for logging
 * @returns Array of actions performed
 * 
 * Workflow:
 * 1. Navigate to URL
 * 2. Wait for page load
 * 3. Initial scroll and reading
 * 4. Random chance to click random quote
 * 5. Random chance to read story
 * 6. Final scroll before leaving
 * 
 * Example:
 * const actions = await visitPage(page, 'https://example.com', behaviorPattern, logger, 'session-123');
 */
export async function visitPage(
    page: Page,
    url: string,
    behavior: BehaviorPattern,
    logger: winston.Logger,
    sessionId: string
): Promise<string[]> {
    const actions: string[] = [];

    try {
        logger.info('Visiting page', { sessionId, url });

        // Navigate to page
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        actions.push('page_loaded');

        // Wait a bit after page load (user orientation time)
        await page.waitForTimeout(randomDelay(1000, 3000));

        // Initial scroll down the page
        const scrollDepth = randomDelay(
            behavior.minScrollDepth,
            behavior.maxScrollDepth
        );
        await scrollPage(page, scrollDepth, logger);
        actions.push(`scrolled_${scrollDepth}%`);

        // Read main quote
        await simulateReading(page, 'blockquote', logger);
        actions.push('read_quote');

        // Random realistic interactions (30% chance each)
        if (Math.random() < 0.3) {
            await simulateMouseMovement(page, logger);
            actions.push('mouse_movement');
        }

        if (Math.random() < 0.3) {
            const selected = await selectRandomText(page, logger);
            if (selected) actions.push('text_selected');
        }

        if (Math.random() < 0.2) {
            await hoverOverElements(page, logger);
            actions.push('hover_elements');
        }

        if (Math.random() < 0.2) {
            const clicked = await randomPageClick(page, logger);
            if (clicked) actions.push('random_click');
        }

        // Random chance to click random quote button
        if (Math.random() < (behavior.clickRandomQuote ? 0.7 : 0)) {
            const clicked = await clickRandomQuote(page, logger);
            if (clicked) {
                actions.push('clicked_random_quote');

                // Read the new quote
                await page.waitForTimeout(randomDelay(500, 1000));
                await simulateReading(page, 'blockquote', logger);
                actions.push('read_new_quote');
            }
        }

        // Random chance to read story
        if (Math.random() < (behavior.readStory ? 0.6 : 0)) {
            const storyRead = await readStory(page, logger);
            if (storyRead) {
                actions.push('read_story');
            }
        }

        // Final time on page
        const timeOnPage = randomDelay(
            behavior.minTimeOnPage * 1000,
            behavior.maxTimeOnPage * 1000
        );
        await page.waitForTimeout(timeOnPage);

        logger.info('Page visit completed', {
            sessionId,
            actionsPerformed: actions.length,
            actions
        });

        return actions;
    } catch (error) {
        if (error instanceof Error) {
            logger.error('Page visit failed', {
                sessionId,
                url,
                errorMessage: error.message
            });
        }
        throw error;
    }
}

/**
 * Executes multi-page browsing session
 * 
 * @param page - Puppeteer page instance
 * @param baseUrl - Base website URL
 * @param behavior - Behavior pattern configuration
 * @param logger - Winston logger
 * @param sessionId - Session ID for logging
 * @returns Session metrics
 * 
 * Multi-page Flow:
 * 1. Visit homepage
 * 2. Optionally visit /all-quotes page
 * 3. Optionally visit /privacy or /terms
 * 4. Track all actions and timing
 * 
 * Example:
 * const metrics = await executeSession(page, 'https://dailyquotes.com', behavior, logger, 'session-123');
 */
export async function executeSession(
    page: Page,
    baseUrl: string,
    behavior: BehaviorPattern,
    logger: winston.Logger,
    sessionId: string
): Promise<SessionMetrics> {
    const startTime = new Date();
    const allActions: string[] = [];
    let pagesVisited = 0;

    try {
        // Visit homepage
        const homeActions = await visitPage(page, baseUrl, behavior, logger, sessionId);
        allActions.push(...homeActions);
        pagesVisited++;

        // Visit additional pages based on behavior
        if (behavior.visitMultiplePages && Math.random() < 0.5) {
            const base = baseUrl.replace(/\/$/, '');
            const additionalPages = [
                `${base}/all-quotes`,
                `${base}/privacy`,
                `${base}/terms`
            ];

            const pagesToVisit = Math.min(
                Math.floor(Math.random() * behavior.maxPagesToVisit) + 1,
                additionalPages.length
            );

            for (let i = 0; i < pagesToVisit; i++) {
                const pageUrl = additionalPages[Math.floor(Math.random() * additionalPages.length)];

                try {
                    const pageActions = await visitPage(page, pageUrl, behavior, logger, sessionId);
                    allActions.push(...pageActions);
                    pagesVisited++;

                    // Wait between page visits
                    await page.waitForTimeout(randomDelay(2000, 5000));
                } catch (error) {
                    logger.warn('Failed to visit additional page', {
                        sessionId,
                        pageUrl
                    });
                }
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
            sessionId,
            startTime,
            endTime,
            duration,
            pagesVisited,
            actionsPerformed: allActions,
            success: true
        };
    } catch (error) {
        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
            sessionId,
            startTime,
            endTime,
            duration,
            pagesVisited,
            actionsPerformed: allActions,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}