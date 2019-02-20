import { ILogger } from '@risevision/core-types';
import { NextFunction, Request, Response } from 'express';

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
};
