/**
 * Dev-only logger. In production builds these are no-ops so ad/update lifecycle
 * chatter never hits the bridge or leaks internal flow to device logs.
 */
export const logger = {
    log: (...args: any[]) => {
        if (__DEV__) console.log(...args);
    },
    warn: (...args: any[]) => {
        if (__DEV__) console.warn(...args);
    },
    error: (...args: any[]) => {
        if (__DEV__) console.error(...args);
    },
};
