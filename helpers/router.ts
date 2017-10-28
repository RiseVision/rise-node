import {NextFunction, Request, RequestHandler, Response, Router} from 'express';
import * as httpApi from './httpApi';

export type IWrappedRouter = Router & {
  map: any, // TODO: fix me
  attachMiddlwareForUrls: (middleware: RequestHandler, routes: string[]) => void
};

/**
 * Express.js router wrapper.
 * @memberof module:helpers
 * @function
 * @returns {Object} router express
 * @throws {Error} If config is invalid
 */
export default function wrapRouter(): IWrappedRouter {
  const router: IWrappedRouter = Router() as any;
  router.use(httpApi.middleware.cors);

  router.map = (root, config) => {

    Object.keys(config).forEach((params) => {
      const route = params.split(' ');
      if (route.length !== 2 || ['post', 'get', 'put'].indexOf(route[0]) === -1) {
        throw Error('Invalid map config');
      }
      router[route[0]](route[1], (req: Request, res: Response, next: NextFunction) => {
        const reqRelevantInfo = {
          ip    : req.ip,
          method: req.method,
          path  : req.path,
        };
        root[config[params]](
          {
            ... {},
            ...reqRelevantInfo,
            ... { body: route[0] === 'get' ? req.query : req.body },
          },
          httpApi.respond.bind(null, res)
        );
      });
    });
  };
  /**
   * Adds one middleware to an array of routes.
   */
  router.attachMiddlwareForUrls = (middleware: RequestHandler, routes: string[]) => {
    routes.forEach((entry) => {
      const route          = entry.split(' ');
      const [method, path] = route;

      if (route.length !== 2 || ['post', 'get', 'put'].indexOf(method) === -1) {
        throw Error('Invalid map config');
      }
      router[method](path, middleware);
    });
  };

  return router;

}
