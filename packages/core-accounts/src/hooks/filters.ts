import { IAccountsModel } from '@risevision/core-interfaces';
import { createFilterDecorator as createFilter } from '@risevision/core-utils';

export const FilterAPIGetAccount = createFilter<(what: any, account?: IAccountsModel) => Promise<any>>('core/apis/accounts/account');
