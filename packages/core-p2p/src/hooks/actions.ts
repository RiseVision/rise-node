import { SignedAndChainedBlockType } from '@risevision/core-types';
import { createActionDecorator as createAction } from '@risevision/core-utils';

export const OnPeersReady = createAction('core-p2p/onPeersReady');
