/**
 * File: src/config/loader.ts
 * 
 * Purpose: Loads and validates configuration files (proxies, users, devices)
 * This module handles reading JSON files, validating data structure, and
 * providing type-safe access to configuration data.
 * 
 * Key Functions:
 * - loadProxies(): Reads proxy list from JSON
 * - loadUsers(): Reads user profiles from JSON
 * - loadDevices(): Reads device configurations from JSON
 * - validateConfig(): Ensures all required files exist and are valid
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProxyConfig, UserProfile, DeviceConfig } from '../types';

/**
 * Loads proxy configurations from JSON file
 * 
 * @param filePath - Absolute or relative path to proxies.json file
 * @returns Array of proxy configurations
 * @throws Error if file doesn't exist or JSON is invalid
 * 
 * Example:
 * const proxies = loadProxies('./config/proxies.json');
 */
export function loadProxies(filePath: string): ProxyConfig[] {
    try {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Proxy config file not found: ${absolutePath}`);
        }

        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const proxies: ProxyConfig[] = JSON.parse(fileContent);

        // Validate structure
        if (!Array.isArray(proxies) || proxies.length === 0) {
            throw new Error('Proxies file must contain a non-empty array');
        }

        // Validate each proxy has required fields
        proxies.forEach((proxy, index) => {
            const required = ['ip', 'port', 'username', 'password'];
            required.forEach(field => {
                if (!(field in proxy)) {
                    throw new Error(`Proxy at index ${index} missing required field: ${field}`);
                }
            });
        });

        return proxies;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load proxies: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Loads user profiles from JSON file
 * 
 * @param filePath - Absolute or relative path to users.json file
 * @returns Array of user profiles
 * @throws Error if file doesn't exist or JSON is invalid
 * 
 * Example:
 * const users = loadUsers('./config/users.json');
 */
export function loadUsers(filePath: string): UserProfile[] {
    try {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Users config file not found: ${absolutePath}`);
        }

        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const users: UserProfile[] = JSON.parse(fileContent);

        // Validate structure
        if (!Array.isArray(users) || users.length === 0) {
            throw new Error('Users file must contain a non-empty array');
        }

        // Validate each user has required fields
        users.forEach((user, index) => {
            const required = ['email', 'username', 'city'];
            required.forEach(field => {
                if (!(field in user)) {
                    throw new Error(`User at index ${index} missing required field: ${field}`);
                }
            });
        });

        return users;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load users: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Loads device configurations from JSON file
 * 
 * @param filePath - Absolute or relative path to devices.json file
 * @returns Array of device configurations (desktop, mobile, tablet)
 * @throws Error if file doesn't exist or JSON is invalid
 * 
 * Example:
 * const devices = loadDevices('./config/devices.json');
 */
export function loadDevices(filePath: string): DeviceConfig[] {
    try {
        const absolutePath = path.resolve(filePath);

        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Devices config file not found: ${absolutePath}`);
        }

        const fileContent = fs.readFileSync(absolutePath, 'utf-8');
        const devices: DeviceConfig[] = JSON.parse(fileContent);

        // Validate structure
        if (!Array.isArray(devices) || devices.length === 0) {
            throw new Error('Devices file must contain a non-empty array');
        }

        return devices;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load devices: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Validates that all required configuration files exist and are readable
 * 
 * @param proxyPath - Path to proxies.json
 * @param userPath - Path to users.json
 * @param devicePath - Path to devices.json
 * @returns Object with validation results and loaded configs
 * @throws Error if any critical validation fails
 * 
 * Example:
 * const config = validateAndLoadConfig(
 *   './config/proxies.json',
 *   './config/users.json', 
 *   './config/devices.json'
 * );
 */
export function validateAndLoadConfig(
    proxyPath: string,
    userPath: string,
    devicePath: string
): {
    proxies: ProxyConfig[];
    users: UserProfile[];
    devices: DeviceConfig[];
    isValid: boolean;
} {
    try {
        const proxies = loadProxies(proxyPath);
        const users = loadUsers(userPath);
        const devices = loadDevices(devicePath);

        console.log(`✓ Loaded ${proxies.length} proxies`);
        console.log(`✓ Loaded ${users.length} users`);
        console.log(`✓ Loaded ${devices.length} device configurations`);

        return {
            proxies,
            users,
            devices,
            isValid: true
        };
    } catch (error) {
        if (error instanceof Error) {
            console.error(`✗ Configuration validation failed: ${error.message}`);
        }
        throw error;
    }
}