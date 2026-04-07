"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestTransport = void 0;
class RestTransport {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    }
    async mediate(request) {
        const endpoint = `${this.baseUrl}/api/mediate`;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(request)
            });
            if (!response.ok) {
                throw new Error(`AARM Platform returned status ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            return result;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`AARM Mediation failed: ${error.message}`);
            }
            throw error;
        }
    }
}
exports.RestTransport = RestTransport;
