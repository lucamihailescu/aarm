"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AarmClient = void 0;
const transport_1 = require("./transport");
class AarmClient {
    config;
    transport;
    constructor(config, transport) {
        this.config = config;
        this.transport = transport || new transport_1.RestTransport(config.baseUrl);
    }
    /**
     * Mediate an action through the AARM platform.
     *
     * @param request The action details to evaluate
     * @returns The decision and optionally a verifiable receipt
     */
    async mediateAction(request) {
        const fullRequest = {
            ...request,
            businessUnit: request.businessUnit || this.config.businessUnit,
            application: request.application || this.config.application,
            principalId: request.principalId || this.config.principalId
        };
        return this.transport.mediate(fullRequest);
    }
}
exports.AarmClient = AarmClient;
