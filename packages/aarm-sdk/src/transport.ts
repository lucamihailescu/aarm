import { RawRequest, MediationResult } from './types';

/**
 * Transport interface defines how the AARM SDK communicates with the AARM Mediate service.
 * This abstraction allows us to switch between REST (HTTP) and gRPC as needed.
 */
export interface Transport {
  mediate(request: RawRequest): Promise<MediationResult>;
}

export class RestTransport implements Transport {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  async mediate(request: RawRequest): Promise<MediationResult> {
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

      const result: MediationResult = await response.json();
      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AARM Mediation failed: ${error.message}`);
      }
      throw error;
    }
  }
}
