import { StubbedInstance } from '../../../core-utils/tests/stubs';
import { BaseTransportMethod } from '../../src/requests';

export class StubbedRequest extends StubbedInstance(class  extends BaseTransportMethod<any, any, any> {
}) {

}

export class StubbedRequest2 extends StubbedInstance(class  extends BaseTransportMethod<any, any, any> {
}) {

}
