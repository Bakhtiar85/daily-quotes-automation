import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as winston from 'winston';

const CHROME_SESSION_PREFIX = 'chrome-session-';
const PUPPETEER_DEV_PREFIX = 'puppeteer_dev_profile-';
const THRESHOLD_BYTES = 900 * 1024 * 1024; // 900 MB
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function getProfileDirs(prefix: string): string[] {
    try {
        return fs.readdirSync(os.tmpdir())
            .filter(name => name.startsWith(prefix))
            .map(name => path.join(os.tmpdir(), name))
            .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
    } catch {
        return [];
    }
}

function dirSizeSync(dirPath: string): number {
    let total = 0;
    try {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            const full = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                total += dirSizeSync(full);
            } else {
                try { total += fs.statSync(full).size; } catch { /* locked */ }
            }
        }
    } catch { /* dir gone mid-scan */ }
    return total;
}

// Kills any Chrome processes whose command line references this specific profile dir.
// Uses wmic to match by --user-data-dir, so only the orphaned Chrome instance is killed.
function killChromeForProfile(profileDir: string, logger: winston.Logger): void {
    const dirName = path.basename(profileDir);
    try {
        const output = execSync(
            `wmic process where "Name like '%chrome%' and CommandLine like '%${dirName}%'" get ProcessId /format:value`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 5000 }
        );

        const pids = (output.match(/ProcessId=(\d+)/g) ?? [])
            .map(m => m.split('=')[1])
            .filter(pid => pid && pid !== '0');

        for (const pid of pids) {
            try {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
                logger.warn('Killed orphaned Chrome process', { pid, profileDir: dirName });
            } catch { /* already exited */ }
        }
    } catch { /* wmic unavailable or no matches — safe to ignore */ }
}

function deleteDir(dir: string, logger: winston.Logger): boolean {
    killChromeForProfile(dir, logger);
    try {
        fs.rmSync(dir, { recursive: true, force: true });
        return true;
    } catch {
        return false;
    }
}

export function runCleanup(getActiveSessions: () => Set<string>, logger: winston.Logger): void {
    const sessionDirs = getProfileDirs(CHROME_SESSION_PREFIX);
    const puppeteerDirs = getProfileDirs(PUPPETEER_DEV_PREFIX);
    const allDirs = [...sessionDirs, ...puppeteerDirs];

    if (allDirs.length === 0) return;

    const totalBytes = allDirs.reduce((sum, d) => sum + dirSizeSync(d), 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

    logger.info('Temp cleanup check', {
        totalMB: `${totalMB} MB`,
        sessionDirs: sessionDirs.length,
        puppeteerDirs: puppeteerDirs.length
    });

    if (totalBytes < THRESHOLD_BYTES) return;

    logger.warn('Temp threshold exceeded — sweeping orphaned profiles', {
        totalMB: `${totalMB} MB`,
        threshold: '900 MB'
    });

    const activeSessions = getActiveSessions();
    let cleaned = 0;
    let skipped = 0;

    // chrome-session-* dirs: skip any that belong to a currently active session
    for (const dir of sessionDirs) {
        const sessionId = path.basename(dir).slice(CHROME_SESSION_PREFIX.length);
        if (activeSessions.has(sessionId)) {
            skipped++;
            continue;
        }
        if (deleteDir(dir, logger)) cleaned++;
        else skipped++;
    }

    // puppeteer_dev_profile-* dirs: always orphans (current code uses chrome-session-* instead)
    for (const dir of puppeteerDirs) {
        if (deleteDir(dir, logger)) cleaned++;
        else skipped++;
    }

    logger.warn('Temp sweep complete', { cleaned, skipped, totalMB: `${totalMB} MB` });
}

export function startCleanupMonitor(
    getActiveSessions: () => Set<string>,
    logger: winston.Logger
): NodeJS.Timeout {
    // Run immediately on start to clear leftovers from any previous crash
    runCleanup(getActiveSessions, logger);

    return setInterval(() => runCleanup(getActiveSessions, logger), MONITOR_INTERVAL_MS);
}

export function stopCleanupMonitor(timer: NodeJS.Timeout): void {
    clearInterval(timer);
}
