import { createActionDecorator as createAction } from '@risevision/core-utils';
import { SignedAndChainedBlockType } from '@risevision/core-types';

export const OnPeersReady = createAction('core-p2p/onPeersReady');
