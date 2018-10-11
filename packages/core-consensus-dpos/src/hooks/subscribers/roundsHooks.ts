import {
  OnCheckIntegrity,
  RecreateAccountsTables,
  SnapshotBlocksCountFilter,
  UtilsCommonHeightList
} from '@risevision/core';
import { OnPostApplyBlock } from '@risevision/core-blocks';
import { ILogger, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { AppConfig, SignedAndChainedBlockType } from '@risevision/core-types';
import { catchToLoggerAndRemapError } from '@risevision/core-utils';
import * as fs from 'fs';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as sequelize from 'sequelize';
import { DposConstantsType, dPoSSymbols } from '../../helpers';
import { RoundsLogic } from '../../logic/rounds';
import { Accounts2DelegatesModel, Accounts2U_DelegatesModel, VotesModel } from '../../models';
import { RoundsModule } from '../../modules';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class RoundsHooks extends Extendable {

  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;

  @inject(dPoSSymbols.modules.rounds)
  private roundsModule: RoundsModule;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.votes)
  private VotesModel: typeof VotesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;

  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2UDelegates)
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;

  @inject(Symbols.generic.constants)
  private constants: DposConstantsType;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @RecreateAccountsTables()
  public async onRecreateAcctTables() {
    const models = [
      this.Accounts2DelegatesModel,
      this.Accounts2U_DelegatesModel,
    ];
    for (const model of models) {
      await model.drop({cascade: true})
        .catch(catchToLoggerAndRemapError('Account#removeTables error', this.logger));
    }

    await this.Accounts2DelegatesModel.sequelize.query(
      fs.readFileSync(`${__dirname}/../../../sql/memoryTables.sql`, {encoding: 'utf8'})
    );
  }

  @OnPostApplyBlock()
  public onPostApplyBlock(block: SignedAndChainedBlockType, tx: sequelize.Transaction) {
    return this.roundsModule.tick(block, tx);
  }

  @UtilsCommonHeightList()
  private async commonHeightList(heights: number[], height: number): Promise<number[]> {
    // Get IDs of first blocks of (n) last rounds, descending order
    // EXAMPLE: For height 2000000 (round 19802) we will get IDs of blocks at height: 1999902, 1999801, 1999700,
    // 1999599, 1999498
    const firstInRound             = this.roundsLogic.firstInRound(this.roundsLogic.calcRound(height));
    const heightsToQuery: number[] = [];
    for (let i = 0; i < 5; i++) {
      heightsToQuery.push(firstInRound - this.constants.activeDelegates * i);
    }
    return heightsToQuery;
  }

  @SnapshotBlocksCountFilter()
  private async snapshotBlockCount(blocksCount: number) {
    const round = this.roundsLogic.calcRound(blocksCount);
    if (typeof(this.appConfig.loading.snapshot) === 'boolean') {
      // threat "true" as "highest round possible"
      this.appConfig.loading.snapshot = round;
    }
    if (this.appConfig.loading.snapshot >= round) {
      this.appConfig.loading.snapshot = round;
      if (blocksCount % this.constants.activeDelegates > 0) {
        // Normalize to previous round if we
        this.appConfig.loading.snapshot = (round > 1) ? (round - 1) : 1;
      }
    }
    return this.roundsLogic.lastInRound(this.appConfig.loading.snapshot - 1);
  }
}
