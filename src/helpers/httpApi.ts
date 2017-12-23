import { Application, NextFunction, Request, Response, Router } from 'express';
import { AppConfig } from '../types/genericTypes';
import { checkIpInList } from './checkIpInList';
import { ILogger } from './logger';

export const middleware = {
  /**
   * Logs api client connections.
   * @param {Logger} logger
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  logClientConnections(logger: ILogger) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Log client connections
      logger.log(req.method + ' ' + req.url + ' from ' + req.ip);
      return next();
    };
  },

  /**
   * Attachs header to response.
   */
  attachResponseHeader(headerKey: string, headerValue: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      res.setHeader(headerKey, headerValue);
      return next();
    };
  },

  /**
   * Applies rules of public / internal API described in config.json.
   */
  applyAPIAccessRules(config: AppConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.url.match(/^\/peer[\/]?.*/)) {
        const internalApiAllowed = config.peers.enabled && !checkIpInList(config.peers.access.blackList,
          req.ip, false);
        rejectDisallowed(internalApiAllowed, config.peers.enabled);
      } else {
        const publicApiAllowed = config.api.enabled && (config.api.access.public ||
          checkIpInList(config.api.access.whiteList, req.ip, false));
        rejectDisallowed(publicApiAllowed, config.api.enabled);
      }

      function rejectDisallowed(apiAllowed, isEnabled) {
        return apiAllowed ? next() : isEnabled ?
          res.status(403).send({success: false, error: 'API access denied'}) :
          res.status(500).send({success: false, error: 'API access disabled'});
      }
    };
  },
};
