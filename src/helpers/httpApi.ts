import { Application, NextFunction, Request, Response, Router } from 'express';
import { AppConfig } from '../types/genericTypes';
import { checkIpInList } from './checkIpInList';
import { ILogger } from './logger';

export const middleware = {
  /**
   * Adds CORS header to all requests.
   */
  cors(req: Request, res: Response, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Objected-With, Content-Type, Accept');
    return next();
  },

  /**
   * Logs all api errors.
   */
  errorLogger(logger) {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      if (!err) {
        return next();
      }
      logger.error('API error ' + req.url, err.message);
      res.status(500).send({success: false, error: 'API error: ' + err.message});
    };
  },

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
   * Resends error msg when blockchain is not loaded.
   * @param {Function} isLoaded
   * @param {Object} req
   * @param {Object} res
   * @param {Function} next
   */
  blockchainReady(isLoaded: () => boolean, req: Request, res: Response, next: NextFunction) {
    if (isLoaded()) {
      return next();
    }
    res.status(500).send({success: false, error: 'Blockchain is loading'});
  },

  /**
   * Resends error if API endpoint doesn't exists.
   */
  notFound(req: Request, res: Response, next: NextFunction) {
    return res.status(500).send({success: false, error: 'API endpoint not found'});
  },

  /**
   * Uses req.sanitize for particular endpoint.
   */
  sanitize(property, schema, cb) {
    return (req: Request & { sanitize: (...args: any[]) => void }, res: Response, next: NextFunction) => {
      req.sanitize(req[property], schema, (err, report, sanitized) => {
        if (!report.isValid) {
          return res.json({success: false, error: report.issues});
        }
        return cb(sanitized, respond.bind(null, res));
      });
    };
  },

  /**
   * Attachs header to response.
   */
  attachResponseHeader(headerKey: string, headerValue: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      res.setHeader(headerKey, headerValue);
      return next();
    }
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
    }
  },

  /**
   * Passes getter for headers and assign then to response.
   */
  attachResponseHeaders(getHeaders: () => any, req: Request, res: Response, next: NextFunction) {
    res.set(getHeaders());
    return next();
  },

  /**
   * Lookup cache, and reply with cached response if it's a hit.
   * If it's a miss, forward the request but cache the response if it's a success.
   * TODO: Describe logger and cache
   */
  useCache(logger: ILogger, cache, req: Request, res: Response, next: NextFunction) {
    if (!cache.isReady()) {
      return next();
    }

    const key = req.originalUrl;
    cache.getJsonForKey(key, (err: Error, cachedValue) => {
      // there was an error or value doesn't exist for key
      if (err || !cachedValue) {
        // Monkey patching res.json function only if we expect to cache response
        const expressSendJson = res.json;
        res.json              = (response) => {
          if (response.success) {
            logger.debug('cached response for key: ', req.url);
            cache.setJsonForKey(key, response);
          }
          return expressSendJson.call(res, response);
        };
        next();
      } else {
        logger.debug(['serving response for url:', req.url, 'from cache'].join(' '));
        res.json(cachedValue);
      }
    });
  },
};

/**
 * Adds 'success' field to every response and attach error message if needed.
 */
export function respond(res: Response, err: Error, response: any) {
  if (err) {
    res.json({success: false, error: err});
  } else {
    return res.json({...{success: true}, ...response});
  }
}

/**
 * Register router in express app using default middleware.
 * @param {String} route
 * @param {Object} app
 * @param {Object} router
 * @param {Function} isLoaded
 */
export function registerEndpoint(route: string, app: Application, router: Router, isLoaded: () => boolean) {
  router.use(middleware.notFound);
  router.use(middleware.blockchainReady.bind(null, isLoaded));
  app.use(route, router);
}
