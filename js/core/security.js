/**
 * MCH Control - Security Core
 * Provides sanitization and hashing utilities to protect against XSS and weak credentials.
 */

const Security = {
    /**
     * Sanitizes HTML strings to prevent XSS.
     * Uses a simple escape strategy if DOMPurify is not available.
     * @param {string} unsafe - The raw string from user input.
     * @returns {string} - The safe string/HTML.
     */
    sanitize: function (unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        // Basic escape for now (Option B Lite)
        // Replaces sensitive characters to prevent script injection
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    /**
     * Sanitizes an object recursively.
     * @param {Object} obj - attributes to sanitize
     */
    sanitizeObject: function (obj) {
        if (typeof obj !== 'object' || obj === null) return obj;
        Object.keys(obj).forEach(key => {
            if (typeof obj[key] === 'string') {
                obj[key] = this.sanitize(obj[key]);
            } else if (typeof obj[key] === 'object') {
                this.sanitizeObject(obj[key]);
            }
        });
        return obj;
    },

    /**
     * Simple Hash for PINs (SHA-256).
     * Returns a Promise as WebCrypto is async.
     * @param {string} message - The PIN or password.
     * @returns {Promise<string>} - The hex hash.
     */
    hash: async function (message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    /**
     * Verify if a raw PIN matches a stored hash.
     */
    verifyPin: async function (raw, storedHash) {
        // Handle migration: if storedHash is short (plain text), compare directly
        if (storedHash.length < 10) return raw === storedHash;

        const newHash = await this.hash(raw);
        return newHash === storedHash;
    }
};

// Expose globally
window.Security = Security;
console.log('🛡️ Security Core Loaded');
