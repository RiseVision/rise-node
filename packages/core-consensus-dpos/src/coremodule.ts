import { APISymbols } from '@risevision/core-apis';
import { IModule, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import {
  ICoreModuleWithModels,
  ModelSymbols,
  utils,
} from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { CommanderStatic } from 'commander';
import { AccountsAPI, DelegatesAPI } from './apis';
import {
  constants,
  DposAppConfig,
  dPoSSymbols,
  DposV2Helper,
  RoundChanges,
  Slots,
} from './helpers';
import { DelegatesHooks, RoundsHooks } from './hooks/subscribers';
import { RegisterDelegateTransaction } from './logic/delegateTransaction';
import { RoundLogic } from './logic/round';
import { RoundsLogic } from './logic/rounds';
import { VoteTransaction } from './logic/voteTransaction';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  DelegatesModel,
  DelegatesPublicKeyModel,
  RoundsFeesModel,
  VotesModel,
} from './models/';
import { DelegatesModule, ForgeModule, RoundsModule } from './modules';

// tslint:disable-next-line no-var-requires
const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<DposAppConfig>
  implements ICoreModuleWithModels {
  public constants = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('--forceForging', 'Forces forging. Despite consensus');
  }

  public addElementsToContainer() {
    this.container.bind(dPoSSymbols.constants).toConstantValue(this.constants);

    // Helpers
    this.container
      .bind(dPoSSymbols.helpers.slots)
      .to(Slots)
      .inSingletonScope();
    this.container
      .bind(dPoSSymbols.helpers.dposV2)
      .to(DposV2Helper)
      .inSingletonScope();
    // this.container
    //   .bind(dPoSSymbols.helpers.forgingPKsInMemoryStore)
    //   .to(Fo)
    //   .inSingletonScope();
    this.container
      .bind(dPoSSymbols.helpers.roundChanges)
      .toConstructor(RoundChanges);

    // APIs
    this.container
      .bind(APISymbols.api)
      .toConstructor(AccountsAPI)
      .whenTargetNamed(dPoSSymbols.accountsAPI);
    this.container
      .bind(APISymbols.api)
      .toConstructor(DelegatesAPI)
      .whenTargetNamed(dPoSSymbols.delegatesAPI);

    this.container.bind(dPoSSymbols.logic.round).toConstructor(RoundLogic);
    this.container
      .bind(dPoSSymbols.logic.rounds)
      .to(RoundsLogic)
      .inSingletonScope();

    // TXS
    this.container
      .bind(TXSymbols.transaction)
      .to(RegisterDelegateTransaction)
      .inSingletonScope()
      .whenTargetNamed(dPoSSymbols.logic.delegateTransaction);
    this.container
      .bind(TXSymbols.transaction)
      .to(VoteTransaction)
      .inSingletonScope()
      .whenTargetNamed(dPoSSymbols.logic.voteTransaction);

    // models
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(Accounts2DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.accounts2Delegates);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(Accounts2U_DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.accounts2UDelegates);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.delegates);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(RoundsFeesModel)
      .whenTargetNamed(dPoSSymbols.models.roundsFees);

    this.container
      .bind(ModelSymbols.model)
      .toConstructor(VotesModel)
      .whenTargetNamed(dPoSSymbols.models.votes);

    // Modules
    this.container
      .bind(dPoSSymbols.modules.delegates)
      .to(DelegatesModule)
      .inSingletonScope();
    this.container
      .bind(dPoSSymbols.modules.forge)
      .to(ForgeModule)
      .inSingletonScope();
    this.container
      .bind(dPoSSymbols.modules.rounds)
      .to(RoundsModule)
      .inSingletonScope();

    this.container
      .bind(dPoSSymbols.hooksSubscribers.rounds)
      .to(RoundsHooks)
      .inSingletonScope();
    this.container
      .bind(dPoSSymbols.hooksSubscribers.delegates)
      .to(DelegatesHooks)
      .inSingletonScope();
  }

  public async initAppElements() {
    await this.container
      .get<RoundsHooks>(dPoSSymbols.hooksSubscribers.rounds)
      .hookMethods();
    await this.container
      .get<DelegatesHooks>(dPoSSymbols.hooksSubscribers.delegates)
      .hookMethods();
  }

  public onPreInitModels() {
    utils.mergeModels(
      AccountsModelForDPOS,
      this.container.getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }

  public async preBoot(): Promise<void> {
    await this.container
      .get<ForgeModule>(dPoSSymbols.modules.forge)
      .hookMethods();
  }

  public async teardown() {
    await this.container
      .get<RoundsHooks>(dPoSSymbols.hooksSubscribers.rounds)
      .unHook();
    await this.container
      .get<DelegatesHooks>(dPoSSymbols.hooksSubscribers.delegates)
      .unHook();
    await this.container.get<ForgeModule>(dPoSSymbols.modules.forge).cleanup();
  }
}
