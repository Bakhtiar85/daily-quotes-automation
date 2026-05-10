import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as winston from 'winston';

const PROFILE_PREFIX = 'chrome-session-';
const THRESHOLD_BYTES = 900 * 1024 * 1024; // 900 MB
const MONITOR_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

function getProfileDirs(): string[] {
    try {
        return fs.readdirSync(os.tmpdir())
            .filter(name => name.startsWith(PROFILE_PREFIX))
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

export function runCleanup(getActiveSessions: () => Set<string>, logger: winston.Logger): void {
    const profileDirs = getProfileDirs();
    if (profileDirs.length === 0) return;

    const totalBytes = profileDirs.reduce((sum, d) => sum + dirSizeSync(d), 0);
    const totalMB = (totalBytes / 1024 / 1024).toFixed(1);

    logger.info('Temp cleanup check', { totalMB: `${totalMB} MB`, dirs: profileDirs.length });

    if (totalBytes < THRESHOLD_BYTES) return;

    logger.warn('Temp threshold exceeded — sweeping orphaned profiles', {
        totalMB: `${totalMB} MB`,
        threshold: '900 MB'
    });

    const activeSessions = getActiveSessions();
    let cleaned = 0;
    let skipped = 0;

    for (const dir of profileDirs) {
        const sessionId = path.basename(dir).slice(PROFILE_PREFIX.length);

        if (activeSessions.has(sessionId)) {
            skipped++;
            continue;
        }

        try {
            fs.rmSync(dir, { recursive: true, force: true });
            cleaned++;
        } catch {
            skipped++;
        }
    }

    logger.warn('Temp sweep complete', { cleaned, skipped, totalMB: `${totalMB} MB` });
}

export function startCleanupMonitor(
    getActiveSessions: () => Set<string>,
    logger: winston.Logger
): NodeJS.Timeout {
    // Run immediately on start to clear any leftovers from a previous crash
    runCleanup(getActiveSessions, logger);

    return setInterval(() => runCleanup(getActiveSessions, logger), MONITOR_INTERVAL_MS);
}

export function stopCleanupMonitor(timer: NodeJS.Timeout): void {
    clearInterval(timer);
}
