import { createFilterDecorator } from '@risevision/core-utils';

export const CommonHeightsToQuery = createFilterDecorator<(
  heights: number[],
  height: number) => Promise<number[]>>('core/blocks/utils/commonHeightList');

// tslint:disable-next-line
type VR = { errors: string[], verified: boolean };

export const VerifyReceipt = createFilterDecorator<(a: VR) => Promise<VR>>('core/blocks/verify/verifyReceipt');
export const VerifyBlock   = createFilterDecorator<(a: VR) => Promise<VR>>('core/blocks/verify/verifyBlock');
