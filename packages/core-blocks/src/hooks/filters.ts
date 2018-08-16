import { createFilterDecorator } from '@risevision/core-utils';
import { SignedBlockType } from '@risevision/core-types';

export const CommonHeightsToQuery = createFilterDecorator<(
  heights: number[],
  height: number) => Promise<number[]>>('core/blocks/utils/commonHeightList');

// tslint:disable-next-line
type VR = { errors: string[], verified: boolean };

export const VerifyReceipt = createFilterDecorator<(a: VR, block?: SignedBlockType) => Promise<VR>>('core/blocks/verify/verifyReceipt');
export const VerifyBlock   = createFilterDecorator<(a: VR, block?: SignedBlockType, lastBlock?: SignedBlockType) => Promise<VR>>('core/blocks/verify/verifyBlock');
