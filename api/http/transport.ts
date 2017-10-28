import {Application} from 'express';
import * as httpApi from '../../helpers/httpApi';
import Router from '../../helpers/router';
import {ILogger} from '../../logger';
import schema from '../../schema/transport';

export default function initHTTPAPI(transportModule, app: Application, logger: ILogger, cache) {

  const router = Router();

  router.use(httpApi.middleware.attachResponseHeaders.bind(null, transportModule.headers));
  router.use(httpApi.middleware.blockchainReady.bind(null, transportModule.isLoaded));

  router.use(handshakeMiddleware);

  router.get('/blocks/common', getCommonBlocksMiddleware);
  router.get('/blocks', httpApi.middleware.sanitize('query', schema.blocks, transportModule.internal.blocks));

  router.map(
    transportModule.internal,
    {
      'get /height'       : 'height',
      'get /list'         : 'list',
      'get /ping'         : 'ping',
      'get /signatures'   : 'getSignatures',
      'get /transactions' : 'getTransactions',
      'post /dapp/message': 'postDappMessage',
      'post /dapp/request': 'postDappRequest',

    }
  );

  // Custom parameters internal functions
  router.post(
    '/blocks',
    (req, res) => transportModule.internal
      .postBlock(
        req.body.block,
        (req as any).peer,
        `${req.method} ${req.url}`,
        httpApi.respond.bind(null, res)
      )
  );

  router.post('/signatures', (req, res) => {
    transportModule.internal.postSignatures({
      signature : req.body.signature,
      signatures: req.body.signatures,
    }, httpApi.respond.bind(null, res));
  });

  router.post(
    '/transactions',
    (req, res) => transportModule.internal
      .postTransactions(
        {
          transaction : req.body.transaction,
          transactions: req.body.transactions,
        },
        (req as any).peer,
        `${req.method} ${req.url}`,
        httpApi.respond.bind(null, res))
  );

  router.use(httpApi.middleware.notFound);

  app.use('/peer', router);

  function handshakeMiddleware(req, res, next) {
    transportModule.internal.handshake(req.ip, req.headers.port, req.headers, validateHeaders, (err, peer) => {
      if (err) {
        return res.status(500).send(err);
      }

      req.peer = peer;

      if (req.body && req.body.dappid) {
        req.peer.dappid = req.body.dappid;
      }
      return next();
    });

    function validateHeaders(headers, cb) {
      return req.sanitize(headers, schema.headers, (err, report, sanitized) => {
        if (err) {
          return cb(err.toString());
        } else if (!report.isValid) {
          return cb(report.issues);
        }

        return cb();
      });
    }
  }

  function getCommonBlocksMiddleware(req, res, next) {
    req.sanitize(req.query, schema.commonBlock, (err, report, query) => {
      if (err) {
        logger.debug('Common block request validation failed', { err: err.toString(), req: req.query });
        return next(err);
      }
      if (!report.isValid) {
        logger.debug('Common block request validation failed', { err: report, req: req.query });
        return res.json({ success: false, error: report.issues });
      }

      return transportModule.internal.blocksCommon(query.ids, req.peer, req.method + ' ' + req.url,
        httpApi.respond.bind(null, res));
    });
  }
}
