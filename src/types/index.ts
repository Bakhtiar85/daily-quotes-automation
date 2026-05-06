/** src\types\index.ts
 * Core type definitions for traffic simulator
 * Defines all interfaces and types used across the system
 */

export interface TrafficSource {
  name: string;
  referer: string;
  weight: number; // Probability weight
}

export interface SessionConfig {
  user: UserProfile;
  proxy: ProxyConfig;
  device: DeviceConfig;
  trafficSource: TrafficSource;  // ADD THIS LINE
  sessionId: string;
  startTime: Date;
}

export interface ProxyConfig {
    ip: string;
    port: number;
    username: string;
    password: string;
    city: string;
    state: string;
    zip?: string;
    country?: string;
}

export interface UserProfile {
    email: string;
    username: string;
    zip?: string;
    city: string;
    state?: string;
    country?: string;
}

export interface DeviceConfig {
    type: 'desktop' | 'mobile' | 'tablet';
    os: 'windows' | 'macos' | 'linux' | 'ios' | 'android';
    browser: 'chrome' | 'firefox' | 'safari' | 'edge';
    userAgent: string;
    viewport: {
        width: number;
        height: number;
    };
    screen: {
        width: number;
        height: number;
    };
    deviceScaleFactor: number;
    isMobile: boolean;
    hasTouch: boolean;
}

export interface SessionConfig {
    user: UserProfile;
    proxy: ProxyConfig;
    device: DeviceConfig;
    sessionId: string;
    startTime: Date;
}

export interface BehaviorPattern {
    minScrollDepth: number;        // 0-100 percentage
    maxScrollDepth: number;        // 0-100 percentage
    minTimeOnPage: number;         // seconds
    maxTimeOnPage: number;         // seconds
    clickRandomQuote: boolean;     // probability 0-1
    readStory: boolean;            // probability 0-1
    visitMultiplePages: boolean;   // probability 0-1
    maxPagesToVisit: number;
}

export interface SimulatorConfig {
    concurrentUsers: number;
    targetUrl: string;
    proxyListPath: string;
    userListPath: string;
    deviceConfigsPath: string;
    logDirectory: string;
    headless: boolean;
    defaultBehavior: BehaviorPattern;
}

export interface SessionMetrics {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;              // milliseconds
    pagesVisited: number;
    actionsPerformed: string[];
    success: boolean;
    errorMessage?: string;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface SimulatorLogger {
    info(message: string, meta?: object): void;
    warn(message: string, meta?: object): void;
    error(message: string, meta?: object): void;
    debug(message: string, meta?: object): void;
}