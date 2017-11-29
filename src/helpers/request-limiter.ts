'use strict';
import {Application} from 'express';
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
export default function applyLimitsToApp(app: Application, config: AppConfig): {
  client: IRateLimiterOpts, peer: IRateLimiterOpts, middleware: {
    client: void, // TODO: In reality its not void but other express app but since i suspect its unused i keep void here
    peer: void
  }
} {
  if (config.trustProxy) {
    app.enable('trust proxy');
  }

  const limits = {
    client    : applyLimits(config.api.options.limits),
    middleware: null,
    peer      : applyLimits(config.peers.options.limits),
  };

  limits.middleware = {
    client: app.use('/api/', new RateLimit(limits.client)),
    peer  : app.use('/peer/', new RateLimit(limits.peer)),
  };

  return limits;
}
