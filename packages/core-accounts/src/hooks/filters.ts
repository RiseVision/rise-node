import { createFilterDecorator as createFilter } from '@risevision/core-utils';

export const FilterAPIGetAccount = createFilter<(what: any) => Promise<any>>('core/apis/accounts/account');
