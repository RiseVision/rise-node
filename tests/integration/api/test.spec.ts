import initializer from '../common/init';
import { Symbols } from '../../../src/ioc/symbols';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
import { wait } from '../../../src/helpers';
describe('brocca', () => {
  initializer.setup();
  initializer.createBlocks(10, 'each');

  it('should brocca', async function () {
    this.timeout(100000);
    const blockModule     = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    console.log(blockModule.lastBlock);

    await initializer.rawMineBlocks(100);
    console.log(blockModule.lastBlock);
    //await wait(1)
    await initializer.rawDeleteBlocks(100);
    console.log(blockModule.lastBlock);

  });
  it('should brocca2', () => {
    const blockModule     = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    console.log(blockModule.lastBlock);
  });
  it('should brocca3', () => {
    const blockModule     = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    console.log(blockModule.lastBlock);
  });
  it('should brocca4', () => {
    const blockModule     = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
    console.log(blockModule.lastBlock);
  });
})