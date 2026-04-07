import { AarmConfig, RawRequest, MediationResult } from './types';
import { Transport, RestTransport } from './transport';

export class AarmClient {
  private config: AarmConfig;
  private transport: Transport;

  constructor(config: AarmConfig, transport?: Transport) {
    this.config = config;
    this.transport = transport || new RestTransport(config.baseUrl);
    this._log('debug', 'AarmClient initialized', { baseUrl: this.config.baseUrl });
  }

  private _log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...meta: any[]) {
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3, none: 4 };
    const configuredLevel = this.config.logLevel || 'none';
    
    if (levels[level] >= levels[configuredLevel]) {
      if (this.config.logger) {
        this.config.logger(level, message, ...meta);
      } else {
        const consoleMethod = level === 'debug' ? 'log' : level;
        console[consoleMethod](`[AARM ${level.toUpperCase()}] ${message}`, ...meta);
      }
    }
  }

  /**
   * Mediate an action through the AARM platform.
   * 
   * @param request The action details to evaluate
   * @returns The decision and optionally a verifiable receipt
   */
  async mediateAction(request: RawRequest): Promise<MediationResult> {
    const fullRequest: RawRequest = {
      ...request,
      businessUnit: request.businessUnit || this.config.businessUnit,
      application: request.application || this.config.application,
      principalId: request.principalId || this.config.principalId
    };

    this._log('debug', `Mediating action: ${request.actionType}`, fullRequest);
    
    try {
      const result = await this.transport.mediate(fullRequest);
      this._log('debug', `Mediation result for ${request.actionType}: ${result.status}`, result);
      return result;
    } catch (err) {
      this._log('error', `Transport failed during mediateAction`, err);
      throw err;
    }
  }
}
