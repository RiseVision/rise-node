import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { expect } from 'chai';
import { Container } from 'inversify';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { AccountsSymbols } from '../../../src';
import { AccountsModel as AMTYpe } from '../../../src/';

describe('AccountsModel', () => {
  let sandbox: SinonSandbox;
  let AccountsModel: typeof AMTYpe;
  let container: Container;
  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-accounts',
      'core-helpers',
      'core-crypto',
      'core-transactions',
    ]);
    AccountsModel = container.getNamed(
      ModelSymbols.model,
      AccountsSymbols.model
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createBulkAccountsSQL', () => {
    it('return empty str if empty arr or filtered arr is empty', () => {
      expect(AccountsModel.createBulkAccountsSQL([])).eq('');
      expect(
        AccountsModel.createBulkAccountsSQL([null, false, undefined, ''] as any)
      ).eq('');
    });
    it('sql injection', () => {
      expect(AccountsModel.createBulkAccountsSQL(['" or "1=1'])).contain(
        'VALUES (\'" or "1=1\')'
      );
      expect(AccountsModel.createBulkAccountsSQL(["'meow')); --'"])).contain(
        "'''meow'')); --'''"
      );
    });
  });

  describe('toPOJO', () => {
    it('should convert any buffer to string', () => {
      const acc = new AccountsModel({
        address: Buffer.from('aa', 'hex'),
      } as any);
      expect(acc.toPOJO()).deep.eq({ address: 'aa' });
    });
  });
});
