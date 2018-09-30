import { APISymbols } from '@risevision/core-apis';
import { IModule, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ICoreModuleWithModels, ModelSymbols, utils } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { CommanderStatic } from 'commander';
import { AccountsAPI, DelegatesAPI } from './apis';
import { constants, DposAppConfig, dPoSSymbols, RoundChanges, Slots } from './helpers';
import { BlockHooks, Transactionshooks } from './hooks/subscribers';
import { RegisterDelegateTransaction } from './logic/delegateTransaction';
import { RoundLogic } from './logic/round';
import { RoundsLogic } from './logic/rounds';
import { VoteTransaction } from './logic/voteTransaction';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  DelegatesModel,
  RoundsFeesModel,
  RoundsModel
} from './models/';
import { DelegatesModule, ForgeModule, RoundsModule } from './modules';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<DposAppConfig> implements ICoreModuleWithModels {
  public constants    = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('--forceForging', 'Forces forging. Despite consensus');
  }

  public addElementsToContainer() {

    this.container.bind(dPoSSymbols.constants)
      .toConstantValue(this.constants);

    // Helpers
    this.container.bind(dPoSSymbols.helpers.slots)
      .to(Slots)
      .inSingletonScope();
    this.container.bind(dPoSSymbols.helpers.roundChanges)
      .toConstructor(RoundChanges);

    // APIs
    this.container.bind(APISymbols.api)
      .to(AccountsAPI).inSingletonScope()
      .whenTargetNamed(dPoSSymbols.accountsAPI);
    this.container.bind(APISymbols.api)
      .to(DelegatesAPI).inSingletonScope()
      .whenTargetNamed(dPoSSymbols.delegatesAPI);

    this.container.bind(dPoSSymbols.logic.round).toConstructor(RoundLogic);
    this.container.bind(dPoSSymbols.logic.rounds).to(RoundsLogic).inSingletonScope();

    // TXS
    this.container.bind(TXSymbols.transaction)
      .to(RegisterDelegateTransaction)
      .inSingletonScope()
      .whenTargetNamed(dPoSSymbols.logic.delegateTransaction);
    this.container.bind(TXSymbols.transaction)
      .to(VoteTransaction)
      .inSingletonScope()
      .whenTargetNamed(dPoSSymbols.logic.voteTransaction);

    // models
    this.container.bind(ModelSymbols.model)
      .toConstructor(Accounts2DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.accounts2Delegates);

    this.container.bind(ModelSymbols.model)
      .toConstructor(Accounts2U_DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.accounts2UDelegates);

    this.container.bind(ModelSymbols.model)
      .toConstructor(DelegatesModel)
      .whenTargetNamed(dPoSSymbols.models.delegates);

    this.container.bind(ModelSymbols.model)
      .toConstructor(RoundsFeesModel)
      .whenTargetNamed(dPoSSymbols.models.roundsFees);

    this.container.bind(ModelSymbols.model)
      .toConstructor(RoundsModel)
      .whenTargetNamed(dPoSSymbols.models.rounds);

    this.container.bind(ModelSymbols.model)
      .toConstructor(RoundsModel)
      .whenTargetNamed(dPoSSymbols.models.votes);

    // Modules
    this.container.bind(dPoSSymbols.modules.delegates)
      .to(DelegatesModule)
      .inSingletonScope();
    this.container.bind(dPoSSymbols.modules.forge)
      .to(ForgeModule)
      .inSingletonScope();
    this.container.bind(dPoSSymbols.modules.rounds)
      .to(RoundsModule)
      .inSingletonScope();

    this.container.bind(dPoSSymbols.hooksSubscribers.blocks)
      .to(BlockHooks)
      .inSingletonScope();
    this.container.bind(dPoSSymbols.hooksSubscribers.transactions)
      .to(Transactionshooks)
      .inSingletonScope();
  }

  public async initAppElements() {
    await this.container.get<any>(dPoSSymbols.hooksSubscribers.blocks)
      .hookMethods();
    await this.container.get<any>(dPoSSymbols.hooksSubscribers.transactions)
      .hookMethods();
  }

  public onPreInitModels() {
    utils.mergeModels(
      AccountsModelForDPOS,
      this.container.getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }

  public async teardown() {
    await this.container.get<any>(dPoSSymbols.hooksSubscribers.blocks)
      .unHook();
    await this.container.get<any>(dPoSSymbols.hooksSubscribers.transactions)
      .unHook();

    await Promise.all([dPoSSymbols.modules.forge, dPoSSymbols.modules.delegates]
      .map((s) => this.container.get<IModule>(s))
      .map((m) => m.cleanup())
    );
  }
}
