import { ExceptionsManager } from '../helpers';
import block127765 from './block_127765';
import tx_10425551571020716913 from './tx_10425551571020716913';
import tx_14712341342146176146 from './tx_14712341342146176146';
import tx_1563714189640390961 from './tx_1563714189640390961';
import tx_5557619371011868150 from './tx_5557619371011868150';

const allExceptionCreator: Array<(exc: ExceptionsManager) => void> = [
  block127765,
  tx_14712341342146176146,
  tx_1563714189640390961,
  tx_10425551571020716913,
  tx_5557619371011868150,
];

export { allExceptionCreator };
