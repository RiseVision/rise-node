'use strict';
import { Application } from 'express';
import * as RateLimit from 'express-rate-limit';
import { AppConfig } from '../types/genericTypes';

export interface IRateLimiterOpts {
  delayAfter: number;
  delayMs: number;
  max: number;
  windowMs: number;
}

const defaults: IRateLimiterOpts = {
  delayAfter: 0, // Disabled
  delayMs   : 0, // Disabled
  max       : 0, // Disabled
  windowMs  : 60000, // 1 minute window
};

/**
 * Returns limits object from input or default values.
 * @private
 * @param {Object} [limits]
 * @returns {Object} max, delayMs, delayAfter, windowMs
 */
export function applyLimits(limits: IRateLimiterOpts): IRateLimiterOpts {
  if (typeof limits === 'object') {
    return {
      delayAfter: Math.floor(limits.delayAfter) || defaults.delayAfter,
      delayMs   : Math.floor(limits.delayMs) || defaults.delayMs,
      max       : Math.floor(limits.max) || defaults.max,
      windowMs  : Math.floor(limits.windowMs) || defaults.windowMs,
    };
  } else {
    return defaults;
  }
}

/**
 * Applies limits config to app
 */
export default function applyLimitsToApp(app: Application, config: AppConfig) {
  if (config.trustProxy) {
    app.enable('trust proxy');
  }

  app.use('/api/', new RateLimit(applyLimits(config.api.options.limits)));
  app.use('/peer/', new RateLimit(applyLimits(config.peers.options.limits)));

}
