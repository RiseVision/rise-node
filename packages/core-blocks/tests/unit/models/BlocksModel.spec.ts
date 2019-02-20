import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { IBlocksModel } from '@risevision/core-types';
import { expect } from 'chai';
import { Container } from 'inversify';
import { BlocksSymbols } from '../../../src/';
import { createFakeBlock } from '../utils/createFakeBlocks';

describe('BlocksModel', () => {
  let container: Container;
  let BlocksModel: typeof IBlocksModel;
  beforeEach(async () => {
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
    BlocksModel = container.getNamed(ModelSymbols.model, BlocksSymbols.model);
  });

  // describe('constructor', () => {
  //   it('should sort transactions by rowId', () => {
  //     const b = new BlocksModel({
  //       transactions: [
  //         { rowId: 10 },
  //         { rowId: 3 },
  //         { rowId: 2 },
  //         { rowId: 4 },
  //       ],
  //     });
  //     expect(b.transactions).to.be.deep.eq([
  //       { rowId: 2 },
  //       { rowId: 3 },
  //       { rowId: 4 },
  //       { rowId: 10 },
  //     ]);
  //   });
  // });
  describe('toStringBlockType', () => {
    it('should convert buffers to strings', () => {
      const b = new BlocksModel(createFakeBlock(container));
      const sb = BlocksModel.toStringBlockType(b);
      expect(sb.blockSignature).is.an('string');
      expect(sb.generatorPublicKey).is.an('string');
      expect(sb.payloadHash).is.an('string');
    });
    // TODO when we have fakee transaction creation
    // it('should convert transactions to POJOS', () => {
    //   const b = new BlocksModel(createFakeBlock(container));
    //   b.transactions =
    // });;
  });
});
