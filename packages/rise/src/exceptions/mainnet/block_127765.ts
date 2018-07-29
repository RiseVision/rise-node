import { DposExceptionsList } from '@risevision/core-consensus-dpos';
import { SignedBlockType } from '@risevision/core-types';
import { ExceptionsManager } from '@risevision/core-exceptions';

// assertValidBlockSlot(block: SignedBlockType): Promise<void>;
export default function block_127765(excManager: ExceptionsManager) {
  excManager.registerExceptionHandler(
    DposExceptionsList.assertValidSlot,
    'block_127765',
    {
      canHandle(obj: any /*DelegatesModule*/, signedBlock: SignedBlockType) {
        return signedBlock.height === 127765;
      },
      handle(obj: any /*DelegatesModule*/, signedBlock: SignedBlockType) {
        // tslint:disable-next-line
        if (signedBlock.generatorPublicKey.toString('hex') === 'c7fc699fa4feabb3709f12c08121ee890ec30ffa379eaa248827a8c4d30bdef7') {
          return Promise.resolve();
        }
        return Promise.reject('[block_127765] Exception handling error should\'ve been a different generator');
      },
    }
  );
  return Promise.resolve();
}
