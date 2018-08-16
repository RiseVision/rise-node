import { BaseCoreModule } from '@risevision/core-launchpad';
import { constants, DposAppConfig, dPoSSymbols } from './helpers';
import { CommanderStatic } from 'commander';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  DelegatesModel,
  RoundsFeesModel,
  RoundsModel
} from './models/';
import { ICoreModuleWithModels, ModelSymbols, utils } from '@risevision/core-models';
import { Symbols } from '@risevision/core-interfaces';
import { APISymbols } from '@risevision/core-apis';
import { AccountsAPI, DelegatesAPI } from './apis';
import { RoundLogic } from './logic/round';
import { RoundsLogic } from './logic/rounds';
import { TXSymbols } from '@risevision/core-transactions';
import { RegisterDelegateTransaction } from './logic/delegateTransaction';
import { VoteTransaction } from './logic/voteTransaction';
import { DelegatesModule, ForgeModule, RoundsModule } from './modules';

const configSchema = require('../schema/config.json');

export class CoreModule extends BaseCoreModule<DposAppConfig> implements ICoreModuleWithModels {
  public constants    = constants;
  public configSchema = configSchema;

  public extendCommander(program: CommanderStatic): void {
    program.option('--forceForging', 'Forces forging. Despite consensus');
  }

  public addElementsToContainer() {
    this.container.bind(APISymbols.api)
      .to(AccountsAPI)
      .whenTargetNamed(dPoSSymbols.accountsAPI);
    this.container.bind(APISymbols.api)
      .to(DelegatesAPI)
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
  }

  public initAppElements() {
  }

  public onPreInitModels() {
    utils.mergeModels(
      AccountsModelForDPOS,
      this.container.getNamed(ModelSymbols.model, Symbols.models.accounts)
    );
  }

  public async teardown() {
    // TODO: Call modules.clean
  }
}
