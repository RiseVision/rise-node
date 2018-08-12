import { createFilterDecorator } from '@risevision/core-utils';

export const CommonHeightsToQuery = createFilterDecorator<(
  heights: number[],
  height: number) => Promise<number[]>>('core/blocks/utils/commonHeightList');
