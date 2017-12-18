import { ExceptionsManager } from '../helpers';
import block127775 from './block_127765';
import tx_14712341342146176146 from './tx_14712341342146176146';

const allExceptionCreator: Array<(exc: ExceptionsManager) => void> = [
  block127775,
  tx_14712341342146176146,
];

export { allExceptionCreator };
