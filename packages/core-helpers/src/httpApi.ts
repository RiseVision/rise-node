import { ILogger } from '@risevision/core-interfaces';
import { AppConfig } from '@risevision/core-types';
import { NextFunction, Request, Response } from 'express';
import { checkIpInList } from './checkIpInList';

export const middleware = {
  /**
   * Logs api client connections.
   * @param {Logger} logger
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
    // TODO: migrate me
    // return (req: Request, res: Response, next: NextFunction) => {
    //   if (req.url.match(/^\/peer[\/]?.*/)) {
    //     const internalApiAllowed = config.peers.enabled && !checkIpInList(config.peers.access.blackList,
    //       req.ip);
    //     rejectDisallowed(internalApiAllowed, config.peers.enabled);
    //   } else {
    //     const publicApiAllowed = config.api.enabled && (config.api.access.public ||
    //       checkIpInList(config.api.access.whiteList, req.ip));
    //     rejectDisallowed(publicApiAllowed, config.api.enabled);
    //   }
    //
    //   function rejectDisallowed(apiAllowed, isEnabled) {
    //     return apiAllowed ? next() : isEnabled ?
    //       res.status(403).send({ success: false, error: 'API access denied' }) :
    //       res.status(500).send({ success: false, error: 'API access disabled' });
    //   }
    // };
  },
};
