import { AccountsModel as AMTYpe } from '../../../src/';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { expect } from 'chai';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { Container } from 'inversify';
import { ModelSymbols } from '@risevision/core-models';
import { AccountsSymbols } from '../../../src';

describe('AccountsModel', () => {
  let sandbox: SinonSandbox;
  let AccountsModel: typeof AMTYpe;
  let container: Container;
  beforeEach(async () => {
    sandbox       = sinon.createSandbox();
    container     = await createContainer(['core-accounts', 'core-helpers', 'core-crypto']);
    AccountsModel = container.getNamed(ModelSymbols.model, AccountsSymbols.model);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createBulkAccountsSQL', () => {
    it('return empty str if empty arr or filtered arr is empty', () => {
      expect(AccountsModel.createBulkAccountsSQL([])).eq('');
      expect(AccountsModel.createBulkAccountsSQL([null, false, undefined, ''] as any)).eq('');
    });
    it('sql injection', () => {
      expect(AccountsModel.createBulkAccountsSQL([ '\" or "1=1'])).contain('VALUES (\'" or "1=1\')');
      expect(AccountsModel.createBulkAccountsSQL([ "'meow')); --'"])).contain('\'\'\'meow\'\')); --\'\'\'');
    });
  });

  describe('toPOJO', () => {
    it('should convert any buffer to string', () => {
      const acc = new AccountsModel({publicKey: Buffer.from('aa', 'hex')});
      expect(acc.toPOJO()).deep.eq({address: null, publicKey: 'aa'});
    });
  });
});
