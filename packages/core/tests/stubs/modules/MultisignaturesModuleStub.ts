import {injectable} from 'inversify';
import {IMultisignaturesModule} from '../../../src/ioc/interfaces/modules';
import {BaseStubClass} from '../BaseStubClass';
import {stubMethod} from '../stubDecorator';

@injectable()
export default class MultisignaturesModuleStub extends BaseStubClass implements IMultisignaturesModule {

    @stubMethod()
    public processSignature(tx: { signature: any, transaction: string }): Promise<void> {
        return undefined;
    }

    // TODO Add more methods when needed
}
