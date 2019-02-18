import {
  RecreateAccountsTables,
  SnapshotBlocksCountFilter,
} from '@risevision/core';
import {
  ApplyBlockDBOps,
  CommonHeightsToQuery,
  RollbackBlockDBOps,
} from '@risevision/core-blocks';
import { ILogger, Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  AppConfig,
  DBOp,
  SignedAndChainedBlockType,
} from '@risevision/core-types';
import { logspace } from '@risevision/core-utils';
import { catchToLoggerAndRemapError } from '@risevision/core-utils';
import * as fs from 'fs';
import { decorate, inject, injectable, named } from 'inversify';
import { range, uniq } from 'lodash';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { DposConstantsType, dPoSSymbols } from '../../helpers';
import { RoundsLogic } from '../../logic/rounds';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  VotesModel,
} from '../../models';
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
  // tslint:disable-next-line
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;

  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;

  @RecreateAccountsTables()
  public async onRecreateAcctTables() {
    const models = [
      this.Accounts2DelegatesModel,
      this.Accounts2U_DelegatesModel,
    ];
    for (const model of models) {
      await model
        .truncate({ cascade: true })
        .catch(
          catchToLoggerAndRemapError('Account#removeTables error', this.logger)
        );
    }
  }

  @ApplyBlockDBOps()
  public async onApplyBlockDBOpsFilter(
    dbOP: Array<DBOp<any>>,
    block: SignedAndChainedBlockType
  ) {
    const roundOps = await this.roundsModule.tick(block);
    return dbOP.concat(...roundOps.filter((op) => op !== null));
  }

  @RollbackBlockDBOps()
  public async onRollbackBlockDBOpsFilter(
    dbOP: Array<DBOp<any>>,
    block: SignedAndChainedBlockType,
    prevBlock: SignedAndChainedBlockType
  ) {
    const roundOps = await this.roundsModule.backwardTick(block, prevBlock);
    return dbOP.concat(...roundOps.filter((op) => op !== null));
  }

  @CommonHeightsToQuery()
  public async commonHeightList(
    heights: number[],
    height: number
  ): Promise<number[]> {
    const logStart = Math.max(1, height - 5);
    const heightsToQuery: number[] = [].concat(
      // First 5 heights will be linear, one after another.
      range(5)
        .map((n) => height - n)
        .filter((n) => n >= 1),
      // The 10 next heights will have logarithmic spacing.
      logspace(Math.log10(1), Math.log10(logStart + 1), 10)
        .map((n) => logStart - (n - 1))
        .map((n) => Math.floor(n))
        .filter((n) => n >= 1)
    );

    return uniq(heightsToQuery);
  }

  @SnapshotBlocksCountFilter()
  private async snapshotBlockCount(blocksCount: number) {
    const round = this.roundsLogic.calcRound(blocksCount);
    if (typeof this.appConfig.loading.snapshot === 'boolean') {
      // threat "true" as "highest round possible"
      this.appConfig.loading.snapshot = round;
    }
    if (this.appConfig.loading.snapshot >= round) {
      this.appConfig.loading.snapshot = round;
      if (blocksCount % this.dposConstants.activeDelegates > 0) {
        // Normalize to previous round if we
        this.appConfig.loading.snapshot = round > 1 ? round - 1 : 1;
      }
    }
    return this.roundsLogic.lastInRound(this.appConfig.loading.snapshot);
  }
}
