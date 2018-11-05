import { createActionDecorator as createAction } from '@risevision/core-utils';
import { Container } from 'inversify';

export const OnInitContainer = createAction<(c?: Container) => Promise<any>>(
  'core/init/container'
);
export const OnFinishBoot = createAction('core/init/onFinishBoot');
