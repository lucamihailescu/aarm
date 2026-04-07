import { AarmConfig, RawRequest, MediationResult } from './types';
import { Transport } from './transport';
export declare class AarmClient {
    private config;
    private transport;
    constructor(config: AarmConfig, transport?: Transport);
    /**
     * Mediate an action through the AARM platform.
     *
     * @param request The action details to evaluate
     * @returns The decision and optionally a verifiable receipt
     */
    mediateAction(request: RawRequest): Promise<MediationResult>;
}
