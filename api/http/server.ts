import {Application} from 'express';
import Router from '../../helpers/router';
/**
 * Renders main page wallet from public folder.
 */
// TODO: Describe serverModule
export default function initHTTPAPI(serverModule, app: Application) {

  const router = Router();

  router.use((req, res, next) => {
    if (serverModule.areModulesReady()) {
      return next();
    }
    res.status(500).send({ success: false, error: 'Blockchain is loading' });
  });

  router.get('/', (req, res) => {
    if (serverModule.isLoaded()) {
      res.render('wallet.html', { layout: false });
    } else {
      res.render('loading.html');
    }
  });

  router.use((req, res, next) => {
    if (req.url.indexOf('/api/') === -1 && req.url.indexOf('/peer/') === -1) {
      return res.redirect('/');
    }
    next();
  });

  app.use('/', router);
}
