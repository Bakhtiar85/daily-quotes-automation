/**
 * File: src/config/referers.ts
 * 
 * Purpose: Defines realistic traffic sources with referer URLs
 * Simulates users coming from different platforms (social, search, direct)
 */

import { TrafficSource } from '../types';

export const TRAFFIC_SOURCES: TrafficSource[] = [
    // Direct traffic (no referer)
    { name: 'Direct', referer: '', weight: 25 },

    // Search engines
    { name: 'Google Search', referer: 'https://www.google.com/search?q=inspirational+quotes', weight: 20 },
    { name: 'Bing Search', referer: 'https://www.bing.com/search?q=daily+quotes', weight: 5 },

    // Social media
    { name: 'Facebook', referer: 'https://www.facebook.com/', weight: 15 },
    { name: 'Instagram', referer: 'https://www.instagram.com/', weight: 10 },
    { name: 'Twitter/X', referer: 'https://twitter.com/', weight: 8 },
    { name: 'Pinterest', referer: 'https://www.pinterest.com/', weight: 7 },
    { name: 'LinkedIn', referer: 'https://www.linkedin.com/', weight: 5 },

    // Other sources
    { name: 'Reddit', referer: 'https://www.reddit.com/', weight: 3 },
    { name: 'WhatsApp', referer: 'https://www.whatsapp.com/', weight: 2 }
];

/**
 * Selects random traffic source based on weights
 */
export function getRandomTrafficSource(): TrafficSource {
    const totalWeight = TRAFFIC_SOURCES.reduce((sum, source) => sum + source.weight, 0);
    let random = Math.random() * totalWeight;

    for (const source of TRAFFIC_SOURCES) {
        random -= source.weight;
        if (random <= 0) {
            return source;
        }
    }

    return TRAFFIC_SOURCES[0]; // Fallback to Direct
}