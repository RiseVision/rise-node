import { StubbedInstance } from '@risevision/core-utils/tests/unit/stubs';
import { BaseTransportMethod } from '../../../src';

// tslint:disable max-classes-per-file

export class StubbedRequest extends StubbedInstance(
  class extends BaseTransportMethod<any, any, any> {}
) {}

export class StubbedRequest2 extends StubbedInstance(
  class extends BaseTransportMethod<any, any, any> {}
) {}
