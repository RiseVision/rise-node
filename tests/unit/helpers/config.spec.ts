import { expect } from 'chai';
import * as mute from 'mute';
import * as rewire from 'rewire';
import * as sinon from 'sinon';
import { config } from '../../../src/helpers';

const RewireConfig = rewire('../../../src/helpers/config');
const z_schema = RewireConfig.__get__('z_schema_1').z_schema;

// config() sometimes does console.log, this function disables console.log before the call and re-enables it after.
const muteConfig = (path) => {
  const unmute = mute();
  const cfg = config(path);
  unmute();
  return cfg;
};

// tslint:disable no-unused-expression
describe('helpers/config', () => {
  let sandbox;
  let exitStub;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    exitStub  = sandbox.stub(process, 'exit');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should load config from the passed path', () => {
    const path = __dirname + '/data/validConfig.json';
    const cfg = muteConfig(path);
    // 5432 is our "marker" value to assess that the right file has been loaded.
    expect(cfg.port).to.be.eq(5432);
  });

  it('should exit process if config file is empty', () => {
    const path = __dirname + '/data/emptyConfig.json';
    muteConfig(path);
    expect(exitStub.called).to.be.true;
  });

  it('should call z_schema.validate()', () => {
    const oldImplementation = z_schema.prototype.validate;
    const stub = sinon.stub(z_schema.prototype, 'validate').returns(true);
    const path = __dirname + '/data/validConfig.json';
    muteConfig(path);
    expect(stub.called).to.be.true;
    z_schema.prototype.validate = oldImplementation;
  });

  it('should exit process if validator returns false', () => {
    const path = __dirname + '/data/invalidConfig.json';
    muteConfig(path);
    expect(exitStub.called).to.be.true;
  });

  it('should force configData.forging.force to false if nethash is part of the nethashes defined in constants', () => {
    // In this file, forging.force is true, but nethash is mainnet
    const path = __dirname + '/data/validConfig.json';
    const cfg = muteConfig(path);
    expect(cfg.forging.force).to.be.false;
  });

});
