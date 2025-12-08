import Log from "./log";

/**
 * Security validation utilities for XSky AI Agent Framework.
 * Provides input validation and sanitization to prevent common security vulnerabilities.
 */

/**
 * Validates a URL to prevent navigation to dangerous schemes.
 * Blocks file://, javascript:, data:, and other potentially dangerous URL schemes.
 * 
 * @param url - The URL to validate
 * @returns Validation result with valid flag and optional reason
 */
export function validateUrl(url: string): { valid: boolean; reason?: string } {
    if (!url || typeof url !== 'string') {
        return { valid: false, reason: 'URL must be a non-empty string' };
    }

    const trimmedUrl = url.trim();

    // Blocked schemes that could be security risks
    const blockedSchemes = [
        'file://',
        'javascript:',
        'data:',
        'vbscript:',
        'about:',
    ];

    const lowerUrl = trimmedUrl.toLowerCase();

    for (const scheme of blockedSchemes) {
        if (lowerUrl.startsWith(scheme)) {
            return {
                valid: false,
                reason: `Blocked URL scheme: ${scheme}. Only http://, https://, and ws:// schemes are allowed.`
            };
        }
    }

    // Basic URL format validation
    try {
        const parsedUrl = new URL(trimmedUrl);
        const allowedProtocols = ['http:', 'https:', 'ws:', 'wss:'];

        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            return {
                valid: false,
                reason: `Unsupported protocol: ${parsedUrl.protocol}. Only http, https, ws, and wss are allowed.`
            };
        }

        return { valid: true };
    } catch (error) {
        // If not a valid URL, check if it's a relative path (which is allowed)
        if (trimmedUrl.startsWith('/') || !trimmedUrl.includes(':')) {
            return { valid: true };
        }

        return {
            valid: false,
            reason: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Validates a file path to prevent path traversal attacks.
 * Blocks paths containing "..", absolute paths starting with "/", and other suspicious patterns.
 * 
 * @param filePath - The file path to validate
 * @param allowAbsolute - Whether to allow absolute paths (default: false)
 * @returns Validation result with valid flag and optional reason
 */
export function validateFilePath(
    filePath: string,
    allowAbsolute: boolean = false
): { valid: boolean; reason?: string } {
    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, reason: 'File path must be a non-empty string' };
    }

    const trimmedPath = filePath.trim();

    // Check for path traversal attempts
    if (trimmedPath.includes('..')) {
        return {
            valid: false,
            reason: 'Path traversal detected: ".." is not allowed in file paths'
        };
    }

    // Check for absolute paths (unless explicitly allowed)
    if (!allowAbsolute && (trimmedPath.startsWith('/') || /^[a-zA-Z]:/.test(trimmedPath))) {
        return {
            valid: false,
            reason: 'Absolute paths are not allowed. Use relative paths only.'
        };
    }

    // Check for null bytes (common in path injection attacks)
    if (trimmedPath.includes('\0')) {
        return {
            valid: false,
            reason: 'Null bytes detected in path'
        };
    }

    // Check for suspicious characters
    const suspiciousChars = ['<', '>', '|', '"', '?', '*'];
    for (const char of suspiciousChars) {
        if (trimmedPath.includes(char)) {
            return {
                valid: false,
                reason: `Suspicious character detected in path: ${char}`
            };
        }
    }

    return { valid: true };
}

/**
 * Sanitizes session data to prevent prototype pollution and injection attacks.
 * Validates JSON structure and removes potentially dangerous properties.
 * 
 * @param data - The raw session data to sanitize
 * @returns Sanitized session data, or throws if data is invalid
 * @throws Error if data structure is invalid or contains dangerous properties
 */
export function sanitizeSessionData(data: unknown): unknown {
    if (typeof data !== 'object' || data === null) {
        throw new Error('Session data must be a valid object');
    }

    // Prevent prototype pollution
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    function removeDangerous(obj: any): any {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => removeDangerous(item));
        }

        const sanitized: any = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && !dangerousKeys.includes(key)) {
                sanitized[key] = removeDangerous(obj[key]);
            } else if (dangerousKeys.includes(key)) {
                Log.warn(`Removed dangerous key from session data: ${key}`);
            }
        }

        return sanitized;
    }

    try {
        return removeDangerous(data);
    } catch (error) {
        throw new Error(`Failed to sanitize session data: ${error instanceof Error ? error.message : String(error)}`);
    }
}
