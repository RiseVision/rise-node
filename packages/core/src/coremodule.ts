import { APISymbols } from '@risevision/core-apis';
import { IInfoModel, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import { ICoreModuleWithModels, ModelSymbols } from '@risevision/core-models';
import * as _ from 'lodash';
import * as uuid from 'uuid';
import { LoaderAPI } from './apis';
import { constants } from './constants';
import { TimeToEpoch } from './helpers';
import { ForkModule, LoaderModule, SystemModule } from './modules';
import { CoreSymbols } from './symbols';

export class CoreModule extends BaseCoreModule<void>
  implements ICoreModuleWithModels {
  public configSchema = {};
  public constants = constants;

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

    let c = this.constants;
    for (const sortedModule of this.sortedModules) {
      c = _.merge(c, sortedModule.constants || {});
    }
    this.container.bind(CoreSymbols.constants).toConstantValue(c);
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
    const infoModel = this.container.getNamed<typeof IInfoModel>(
      ModelSymbols.model,
      ModelSymbols.names.info
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
    const loaderModule = this.container.get<LoaderModule>(
      CoreSymbols.modules.loader
    );
    await loaderModule.loadBlockChain();
  }
  public async teardown(): Promise<void> {
    await this.container
      .get<LoaderModule>(CoreSymbols.modules.loader)
      .cleanup();
  }
}
