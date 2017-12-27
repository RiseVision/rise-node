import { ExceptionsList, ExceptionsManager } from '../helpers';
import { IDelegatesModule } from '../ioc/interfaces/modules';
import { SignedBlockType } from '../logic';
// assertValidBlockSlot(block: SignedBlockType): Promise<void>;
export default function block_127765(excManager: ExceptionsManager) {
  excManager.registerExceptionHandler(
    ExceptionsList.assertValidSlot,
    'block_127765',
    {
      canHandle(obj: IDelegatesModule, signedBlock: SignedBlockType) {
        return signedBlock.height === 127765;
      },
      handle(obj: IDelegatesModule, signedBlock: SignedBlockType) {
        if (signedBlock.generatorPublicKey === 'c7fc699fa4feabb3709f12c08121ee890ec30ffa379eaa248827a8c4d30bdef7') {
          return Promise.resolve();
        }
        return Promise.reject('[block_127765] Exception handling error should\'ve been a different generator');
      },
    }
  );
}
