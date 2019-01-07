import { OnCheckIntegrity, RecreateAccountsTables } from '@risevision/core';
import { ILogger, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { catchToLoggerAndRemapError } from '@risevision/core-utils';
import * as fs from 'fs';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as path from 'path';
import * as sequelize from 'sequelize';
import { Op } from 'sequelize';
import { AccountsModel } from '../../models';
import { AccountsSymbols } from '../../symbols';

const DecoratedSubscriber = WPHooksSubscriber(Object);
decorate(injectable(), DecoratedSubscriber);

@injectable()
export class AccountsLoaderSubscriber extends DecoratedSubscriber {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private AccountsModel: typeof AccountsModel;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @RecreateAccountsTables()
  public async recreateTables(): Promise<void> {
    await this.AccountsModel.truncate({ cascade: true }).catch(
      catchToLoggerAndRemapError('Account#removeTables error', this.logger)
    );
  }

  @OnCheckIntegrity()
  private async onLoadIntegrityChecks(b: number) {
    const orphanedMemAccounts = await this.AccountsModel.sequelize.query(
      fs.readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          '..',
          'sql',
          'getOrphanedMemAccounts.sql'
        ),
        { encoding: 'utf8' }
      ),
      { type: sequelize.QueryTypes.SELECT }
    );

    if (orphanedMemAccounts.length > 0) {
      throw new Error('Detected orphaned blocks in mem_accounts');
    }
  }
}
