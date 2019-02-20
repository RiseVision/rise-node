import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ConstantsType, Symbols } from '@risevision/core-types';
import { expect } from 'chai';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox } from 'sinon';
import { TimeToEpoch } from '../../../src/helpers';

describe('timeToEpoch', () => {
  let instance: TimeToEpoch;
  let container: Container;
  let sandbox: SinonSandbox;
  let constants: ConstantsType;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core',
      'core-helpers',
      'core-crypto',
      'core-accounts',
      'core-transactions',
    ]);
    constants = container.get(Symbols.generic.constants);
    instance = container.get(Symbols.helpers.timeToEpoch);
  });

  it('should derive proper epoch time from unix', () => {
    expect(instance.getTime(constants.epochTime.getTime())).eq(0);
    expect(instance.getTime(constants.epochTime.getTime() + 15000)).eq(15);
  });
  it('should derive proper unix time from epoch time', () => {
    expect(instance.fromTimeStamp(0)).eq(constants.epochTime.getTime());
    expect(instance.fromTimeStamp(15)).eq(
      constants.epochTime.getTime() + 15000
    );
  });
});
