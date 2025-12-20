/**
 * File: src/config/matcher.ts
 * 
 * Purpose: Intelligent matching logic for pairing users with proxies and devices
 * This module implements geo-matching (user zip → proxy zip) and random device
 * assignment to create realistic traffic patterns.
 * 
 * Key Functions:
 * - matchProxyToUser(): Finds best proxy match for a user based on location
 * - getRandomDevice(): Selects random device configuration
 * - createSessionPairs(): Creates complete user+proxy+device combinations
 */

import { ProxyConfig, UserProfile, DeviceConfig, SessionConfig } from '../types';
import { randomUUID } from 'crypto';

/**
 * Matches a user to the best available proxy based on geographic location
 * 
 * @param user - User profile containing zip code and city
 * @param proxies - Available proxy configurations
 * @param usedProxies - Set of proxy IPs already in use (to avoid conflicts)
 * @returns Best matching proxy or random proxy if no geo-match found
 * 
 * Matching Logic:
 * 1. First priority: Exact zip code match
 * 2. Second priority: Same city match
 * 3. Fallback: Random available proxy
 * 
 * Example:
 * const proxy = matchProxyToUser(user, allProxies, new Set());
 */
export function matchProxyToUser(
    user: UserProfile,
    proxies: ProxyConfig[],
    usedProxies: Set<string> = new Set()
): ProxyConfig {
    // Filter out already used proxies
    const availableProxies = proxies.filter(p => !usedProxies.has(p.ip));

    if (availableProxies.length === 0) {
        throw new Error('No available proxies. All proxies are currently in use.');
    }

    // Strategy 1: Try exact zip match
    const zipMatch = availableProxies.find(p => p.zip === user.zip);
    if (zipMatch) {
        console.log(`✓ Matched user ${user.username} with proxy (ZIP: ${user.zip})`);
        return zipMatch;
    }

    // Strategy 2: Try city match
    const cityMatch = availableProxies.find(
        p => p.city.toLowerCase() === user.city.toLowerCase()
    );
    if (cityMatch) {
        console.log(`✓ Matched user ${user.username} with proxy (City: ${user.city})`);
        return cityMatch;
    }

    // Strategy 3: Random fallback
    const randomProxy = availableProxies[Math.floor(Math.random() * availableProxies.length)];
    console.log(`⚠ No geo-match for ${user.username}, using random proxy from ${randomProxy.city}`);
    return randomProxy;
}

/**
 * Selects a random device configuration from available options
 * 
 * @param devices - Array of device configurations (desktop, mobile, tablet)
 * @returns Randomly selected device configuration
 * 
 * Purpose: Creates device diversity in traffic simulation
 * Simulates real-world scenario where users access from different devices
 * 
 * Example:
 * const device = getRandomDevice(allDevices);
 */
export function getRandomDevice(devices: DeviceConfig[]): DeviceConfig {
    if (devices.length === 0) {
        throw new Error('No device configurations available');
    }

    const randomIndex = Math.floor(Math.random() * devices.length);
    const device = devices[randomIndex];

    console.log(`✓ Selected device: ${device.os} ${device.type} (${device.browser})`);
    return device;
}

/**
 * Creates complete session configurations by pairing users, proxies, and devices
 * 
 * @param users - Array of user profiles
 * @param proxies - Array of proxy configurations
 * @param devices - Array of device configurations
 * @param count - Number of session pairs to create (default: 5)
 * @returns Array of complete session configurations
 * 
 * Algorithm:
 * 1. Randomly select 'count' users
 * 2. For each user, find best geo-matched proxy
 * 3. Assign random device to each pair
 * 4. Generate unique session ID
 * 5. Track used proxies to prevent conflicts
 * 
 * Example:
 * const sessions = createSessionPairs(users, proxies, devices, 5);
 * // Returns 5 complete session configs ready for simulation
 */
export function createSessionPairs(
    users: UserProfile[],
    proxies: ProxyConfig[],
    devices: DeviceConfig[],
    count: number = 5
): SessionConfig[] {
    if (users.length === 0) {
        throw new Error('No users available for session creation');
    }

    if (proxies.length < count) {
        throw new Error(
            `Not enough proxies. Requested ${count} sessions but only ${proxies.length} proxies available.`
        );
    }

    const sessions: SessionConfig[] = [];
    const usedProxies = new Set<string>();

    // Shuffle users to randomize selection
    const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
    const selectedUsers = shuffledUsers.slice(0, count);

    selectedUsers.forEach((user, index) => {
        try {
            // Match user to best available proxy
            const proxy = matchProxyToUser(user, proxies, usedProxies);
            usedProxies.add(proxy.ip);

            // Select random device
            const device = getRandomDevice(devices);

            // Create session configuration
            const session: SessionConfig = {
                user,
                proxy,
                device,
                sessionId: randomUUID(),
                startTime: new Date()
            };

            sessions.push(session);
            console.log(`✓ Created session ${index + 1}/${count} for ${user.username}`);
        } catch (error) {
            if (error instanceof Error) {
                console.error(`✗ Failed to create session for ${user.username}: ${error.message}`);
            }
        }
    });

    return sessions;
}

/**
 * Validates that session configuration is complete and ready for use
 * 
 * @param session - Session configuration to validate
 * @returns True if session is valid, throws error otherwise
 * @throws Error with specific validation failure message
 * 
 * Checks:
 * - Session ID exists
 * - User profile is complete
 * - Proxy config is complete
 * - Device config is complete
 * 
 * Example:
 * validateSession(sessionConfig); // throws if invalid
 */
export function validateSession(session: SessionConfig): boolean {
    if (!session.sessionId) {
        throw new Error('Session missing sessionId');
    }

    if (!session.user.email || !session.user.username) {
        throw new Error('Session has incomplete user profile');
    }

    if (!session.proxy.ip || !session.proxy.port) {
        throw new Error('Session has incomplete proxy configuration');
    }

    if (!session.device.userAgent || !session.device.viewport) {
        throw new Error('Session has incomplete device configuration');
    }

    return true;
}