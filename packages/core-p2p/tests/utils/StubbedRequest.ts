import { StubbedInstance } from '../../../core-utils/tests/stubs';
import { BaseRequest } from '../../src/requests';

export class StubbedRequest extends StubbedInstance(class  extends BaseRequest<any, any> {
}) {

}
