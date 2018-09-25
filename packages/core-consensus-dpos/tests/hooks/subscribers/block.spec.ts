import { Container } from 'inversify';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { createContainer } from '@risevision/core-launchpad/tests/utils/createContainer';
import { BlockHooks } from '../../../src/hooks/subscribers';
import { dPoSSymbols } from '../../../src/helpers';
import { WordPressHookSystem } from 'mangiafuoco';
import { OnPostApplyBlock } from '@risevision/core-blocks';
import { createFakeBlock } from '@risevision/core-blocks/tests/utils/createFakeBlocks';
import { Symbols } from '@risevision/core-interfaces';
import { RoundsModule } from '../../../src/modules';

describe('hooks/subscribers/block', () => {
  let container: Container;
  let instance: BlockHooks;
  let wphooksystem: WordPressHookSystem;
  let roundsModule: RoundsModule;
  before(async () => {
    container     = await createContainer(['core-consensus-dpos', 'core-transactions', 'core', 'core-helpers']);
    instance      = container.get(dPoSSymbols.hooksSubscribers.blocks);
    wphooksystem  = container.get(Symbols.generic.hookSystem);
    roundsModule  = container.get(dPoSSymbols.modules.rounds);
  });

  it('should call round tick', async () => {
    const stub  = sinon.stub(roundsModule, 'tick').resolves();
    const block = createFakeBlock(container);
    await wphooksystem.do_action(OnPostApplyBlock.name, block, {tx: 'ciao'});
    expect(stub.called).is.true;
    expect(stub.firstCall.args[0]).deep.eq(block);
    expect(stub.firstCall.args[1]).deep.eq({tx: 'ciao'});
  });
});
