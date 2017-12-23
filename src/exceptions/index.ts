import { ExceptionsManager } from '../helpers';
import block127775 from './block_127765';
import tx_14712341342146176146 from './tx_14712341342146176146';
import tx_1563714189640390961 from './tx_1563714189640390961';

const allExceptionCreator: Array<(exc: ExceptionsManager) => void> = [
  block127775,
  tx_14712341342146176146,
  tx_1563714189640390961,
];

export { allExceptionCreator };
