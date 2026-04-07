import { RawRequest, MediationResult } from './types';
/**
 * Transport interface defines how the AARM SDK communicates with the AARM Mediate service.
 * This abstraction allows us to switch between REST (HTTP) and gRPC as needed.
 */
export interface Transport {
    mediate(request: RawRequest): Promise<MediationResult>;
}
export declare class RestTransport implements Transport {
    private baseUrl;
    constructor(baseUrl: string);
    mediate(request: RawRequest): Promise<MediationResult>;
}
