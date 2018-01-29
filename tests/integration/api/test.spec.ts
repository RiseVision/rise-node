import initializer from '../common/init';
import { Symbols } from '../../../src/ioc/symbols';
import { IBlocksModule } from '../../../src/ioc/interfaces/modules';
describe('brocca', () => {
  initializer.setup();
  initializer.createBlocks(10, 'each');

  it('should brocca', () => {
    const blockModule     = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
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