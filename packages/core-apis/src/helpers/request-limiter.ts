import { RequestHandler } from 'express';
import * as RateLimit from 'express-rate-limit';

export interface IRateLimiterOpts {
  delayAfter: number;
  delayMs: number;
  max: number;
  windowMs: number;
}

const defaults: IRateLimiterOpts = {
  delayAfter: 0, // Disabled
  delayMs: 0, // Disabled
  max: 0, // Disabled
  windowMs: 60000 // 1 minute window
};

/**
 * Returns limits object from input or default values.
 * @private
 * @param {Object} [limits]
 * @returns {Object} max, delayMs, delayAfter, windowMs
 */
function applyLimits(limits: IRateLimiterOpts): IRateLimiterOpts {
  if (typeof limits === 'object') {
    return {
      delayAfter: Math.floor(limits.delayAfter) || defaults.delayAfter,
      delayMs: Math.floor(limits.delayMs) || defaults.delayMs,
      max: Math.floor(limits.max) || defaults.max,
      windowMs: Math.floor(limits.windowMs) || defaults.windowMs
    };
  } else {
    return defaults;
  }
}

export function limitsMiddleware(limits: IRateLimiterOpts): RequestHandler {
  return new RateLimit(applyLimits(limits));
}
