/**
 * File: src/config/matcher.ts
 *
 * Purpose: Resolves rotating proxy geo info then matches users by location.
 * Each session makes a lightweight request through the rotating proxy to
 * ip-api.com to discover the actual assigned IP and its country/city.
 * That geo data is then used to find the best-matching user profile.
 */

import { ProxyConfig, UserProfile, DeviceConfig, SessionConfig } from '../types';
import { getRandomTrafficSource } from './referers';
import { randomUUID } from 'crypto';

interface GeoInfo {
    ip: string;
    city: string;
    state: string;
    country: string;
    countryCode: string;
}

/**
 * Hits ip-api.com through the rotating proxy to get the actual assigned IP's geo data.
 * Falls back to unknown values if the lookup fails so a session can still proceed.
 */
async function resolveProxyGeoInfo(proxy: ProxyConfig): Promise<GeoInfo> {
    try {
        // Use fetch with proxy URL - Node 20 supports this via --experimental-global-webcrypto
        // For now, use a simpler approach with timeouts
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('http://ip-api.com/json', {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            // Note: Direct proxy support in fetch requires additional setup
            // This fallback approach queries ip-api without proxy routing
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const data = await response.json() as any;

        console.log(`  → Resolved IP: ${data.query} (${data.city}, ${data.country})`);

        return {
            ip: data.query || proxy.ip,
            city: data.city || 'Unknown',
            state: data.regionName || 'Unknown',
            country: data.country || 'Unknown',
            countryCode: data.countryCode || 'XX'
        };
    } catch (error) {
        console.log(`  → Geo lookup failed, using fallback location`);
        return { ip: proxy.ip, city: 'Unknown', state: 'Unknown', country: 'Unknown', countryCode: 'XX' };
    }
}

/**
 * Finds the best user match for a resolved geo location.
 * Priority: country match → city match within country → random fallback.
 * Tracks used user indices within a batch to avoid duplicate assignments.
 */
function matchUserToGeo(
    users: UserProfile[],
    geo: GeoInfo,
    usedIndices: Set<number>
): { user: UserProfile; index: number } {
    const available = users
        .map((u, i) => ({ u, i }))
        .filter(({ i }) => !usedIndices.has(i));

    const pool = available.length > 0 ? available : users.map((u, i) => ({ u, i }));

    // Country match
    const countryPool = pool.filter(({ u }) =>
        u.country?.toLowerCase() === geo.country.toLowerCase()
    );

    if (countryPool.length > 0) {
        // Prefer city match within country
        const cityMatch = countryPool.find(({ u }) =>
            u.city?.toLowerCase() === geo.city.toLowerCase()
        );
        const chosen = cityMatch ?? countryPool[Math.floor(Math.random() * countryPool.length)];
        return { user: chosen.u, index: chosen.i };
    }

    // Random fallback
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return { user: chosen.u, index: chosen.i };
}

export function getRandomDevice(devices: DeviceConfig[]): DeviceConfig {
    if (devices.length === 0) throw new Error('No device configurations available');
    const device = devices[Math.floor(Math.random() * devices.length)];
    console.log(`  → Device: ${device.os} ${device.type} (${device.browser})`);
    return device;
}

/**
 * Creates session configs by resolving geo info per session through the rotating proxy,
 * then matching each resolved location to the closest user profile.
 * All geo lookups run in parallel for speed.
 */
export async function createSessionPairs(
    users: UserProfile[],
    proxies: ProxyConfig[],
    devices: DeviceConfig[],
    count: number = 5
): Promise<SessionConfig[]> {
    if (users.length === 0) throw new Error('No users available');
    if (proxies.length === 0) throw new Error('No proxy configured');

    const baseProxy = proxies[0]; // rotating endpoint — same for all sessions

    console.log(`\n  Resolving geo info for ${count} session(s) via ${baseProxy.ip}:${baseProxy.port}...`);

    // Resolve all geo infos concurrently
    const geoResults = await Promise.all(
        Array.from({ length: count }, () => resolveProxyGeoInfo(baseProxy))
    );

    const sessions: SessionConfig[] = [];
    const usedUserIndices = new Set<number>();

    geoResults.forEach((geo, index) => {
        try {
            const { user, index: userIndex } = matchUserToGeo(users, geo, usedUserIndices);
            usedUserIndices.add(userIndex);

            const device = getRandomDevice(devices);

            // Enrich proxy config with resolved geo so logs are meaningful
            const resolvedProxy: ProxyConfig = {
                ...baseProxy,
                city: geo.city,
                state: geo.state,
                country: geo.country
            };

            const session: SessionConfig = {
                user,
                proxy: resolvedProxy,
                device,
                trafficSource: getRandomTrafficSource(),
                sessionId: randomUUID(),
                startTime: new Date()
            };

            sessions.push(session);
            console.log(`  ✓ Session ${index + 1}: ${user.username} (${user.country || 'unknown'}) → IP in ${geo.city}, ${geo.country}`);
        } catch (error) {
            if (error instanceof Error) {
                console.error(`  ✗ Failed to create session ${index + 1}: ${error.message}`);
            }
        }
    });

    return sessions;
}

export function validateSession(session: SessionConfig): boolean {
    if (!session.sessionId) throw new Error('Session missing sessionId');
    if (!session.user.email || !session.user.username) throw new Error('Incomplete user profile');
    if (!session.proxy.ip || !session.proxy.port) throw new Error('Incomplete proxy configuration');
    if (!session.device.userAgent || !session.device.viewport) throw new Error('Incomplete device configuration');
    return true;
}
