import {wait} from '@risevision/core-utils';
import * as express from 'express';
import { Express } from 'express';
import * as supertest from 'supertest';
import {limitsMiddleware} from '../src/helpers';
describe('requestLimiter', () => {
  let app: Express;
  beforeEach(() => {
    app = express();
  });

  it('should limit number of requests', async () => {
    app.use(limitsMiddleware({max: 1, windowMs: 1000, delayMs: 0, delayAfter: 0}));
    app.get('/', (req, res) => res.send('ok'));
    await supertest(app).get('/').expect(200);
    await supertest(app).get('/').expect(429);
    await wait(1000);
    await supertest(app).get('/').expect(200);
  });
});