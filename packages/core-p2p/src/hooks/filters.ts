import {createFilterDecorator as createFilter} from '@risevision/core-helpers';

/**
 * Filter headers to be sent.
 */
export const FilterHeaders = createFilter<(headers: {[k: string]: string}) => Promise<{[k: string]: string}>>('core-p2p/headers');
