import { APISymbols } from '@risevision/core-apis';
import { IInfoModel, Symbols } from '@risevision/core-interfaces';
import { BaseCoreModule } from '@risevision/core-launchpad';
import * as _ from 'lodash';
import * as uuid from 'uuid';
import { LoaderAPI } from './apis';
import { constants } from './constants';
import { TimeToEpoch } from './helpers';
import { ForkModule, LoaderModule, SystemModule } from './modules';
import { CoreSymbols } from './symbols';

export class CoreModule extends BaseCoreModule<void> {
  public configSchema = {};
  public constants    = constants;

  public addElementsToContainer(): void {
    this.container.bind(Symbols.helpers.timeToEpoch).to(TimeToEpoch).inSingletonScope();
    this.container.bind(CoreSymbols.constants).toConstantValue(this.constants);
    this.container.bind(CoreSymbols.modules.fork).to(ForkModule).inSingletonScope();
    this.container.bind(CoreSymbols.modules.system).to(SystemModule).inSingletonScope();
    this.container.bind(CoreSymbols.modules.loader).to(LoaderModule).inSingletonScope();
    this.container.bind(APISymbols.api).to(LoaderAPI)
      .inSingletonScope()
      .whenTargetNamed(CoreSymbols.api.loader);
  }

  public initAppElements() {
    let c = this.container.get<any>(CoreSymbols.constants);
    for (const sortedModule of this.sortedModules) {
      c = _.merge(c, sortedModule.constants || {});
    }
  }

  public async boot() {
    const infoModel = this.container.get<typeof IInfoModel>(Symbols.models.info);
    // Create or restore nonce!
    const [val] = await infoModel
      .findOrCreate({where: {key: 'nonce'}, defaults: {value: uuid.v4()}});
    this.container.bind(Symbols.generic.nonce).toConstantValue(val.value);
    await infoModel
      .upsert({
        key  : 'genesisAccount',
        value: this.container.get<any>(Symbols.generic.genesisBlock)
          .transactions[0].senderId,
      });

    const loaderModule = this.container.get<LoaderModule>(CoreSymbols.modules.loader);
    await loaderModule.loadBlockChain();
  }
  public async teardown(): Promise<void> {
    await this.container.get<LoaderModule>(CoreSymbols.modules.loader).cleanup();
  }
}
