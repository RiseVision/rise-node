import { APISymbols } from '@risevision/core-apis';
import { ICoreModuleWithModels, ModelSymbols } from '@risevision/core-models';
import { BaseCoreModule, IInfoModel, Symbols } from '@risevision/core-types';
import * as _ from 'lodash';
import * as uuid from 'uuid';
import { ConstantsAPI, LoaderAPI } from './apis';
import { Migrator, TimeToEpoch } from './helpers';
import { BlockMonitor } from './hooks';
import { InfoModel, MigrationsModel } from './models';
import { ForkModule, LoaderModule, SystemModule } from './modules';
import { CoreSymbols } from './symbols';

export class CoreModule extends BaseCoreModule<void>
  implements ICoreModuleWithModels {
  public configSchema = {};
  public constants = {};

  public async addElementsToContainer() {
    this.container
      .bind(Symbols.helpers.timeToEpoch)
      .to(TimeToEpoch)
      .inSingletonScope();

    this.container
      .bind(CoreSymbols.modules.fork)
      .to(ForkModule)
      .inSingletonScope();
    this.container
      .bind(CoreSymbols.modules.system)
      .to(SystemModule)
      .inSingletonScope();
    this.container
      .bind(CoreSymbols.modules.loader)
      .to(LoaderModule)
      .inSingletonScope();
    this.container
      .bind(APISymbols.api)
      .toConstructor(LoaderAPI)
      .whenTargetNamed(CoreSymbols.api.loader);
    this.container
      .bind(APISymbols.api)
      .toConstructor(ConstantsAPI)
      .whenTargetNamed(CoreSymbols.api.constants);

    this.container
      .bind(CoreSymbols.__internals.blockMonitor)
      .to(BlockMonitor)
      .inSingletonScope();

    // Set constants
    for (const sortedModule of this.sortedModules) {
      let b = sortedModule.constants || {};
      for (const iM of this.sortedModules) {
        if (iM.constants && iM.constants[sortedModule.name]) {
          b = _.merge(b, iM.constants[sortedModule.name]);
        }
      }
      sortedModule.constants = b;
    }
    this.container.bind(CoreSymbols.constants).toConstantValue(this.constants);

    // add info and migrations model
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(InfoModel)
      .whenTargetNamed(CoreSymbols.models.info);
    this.container
      .bind(ModelSymbols.model)
      .toConstructor(MigrationsModel)
      .whenTargetNamed(CoreSymbols.models.migrations);

    this.container
      .bind(CoreSymbols.helpers.migrator)
      .to(Migrator)
      .inSingletonScope();
  }

  public initAppElements(): Promise<void> | void {
    const c = this.container.get<any>(CoreSymbols.constants);
    c.epochTime = new Date(c.epochTime);
    c.fees.forEach((f) => {
      Object.keys(f.fees).forEach((fK) => {
        f.fees[fK] = BigInt(f.fees[fK]);
      });
    });
  }

  public async onPostInitModels() {
    // Start migrator.
    await this.container.get<Migrator>(CoreSymbols.helpers.migrator).init();

    const infoModel = this.container.getNamed<typeof IInfoModel>(
      ModelSymbols.model,
      CoreSymbols.models.info
    );
    // Create or restore nonce!
    const [val] = await infoModel.findOrCreate({
      defaults: { value: uuid.v4() },
      where: { key: 'nonce' },
    });

    this.container.bind(Symbols.generic.nonce).toConstantValue(val.value);
    await infoModel.upsert({
      key: 'genesisAccount',
      value: this.container.get<any>(Symbols.generic.genesisBlock)
        .transactions[0].senderId,
    });
  }

  public async boot() {
    await this.container
      .get<BlockMonitor>(CoreSymbols.__internals.blockMonitor)
      .hookMethods();

    const loaderModule = this.container.get<LoaderModule>(
      CoreSymbols.modules.loader
    );
    await loaderModule.loadBlockChain();
  }

  public async teardown(): Promise<void> {
    await this.container
      .get<BlockMonitor>(CoreSymbols.__internals.blockMonitor)
      .unHook();

    await this.container
      .get<LoaderModule>(CoreSymbols.modules.loader)
      .cleanup();
  }
}
