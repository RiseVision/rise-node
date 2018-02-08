import {injectable} from 'inversify';
import {BaseStubClass} from '../BaseStubClass';
import {stubMethod} from '../stubDecorator';
import {IMultisignaturesModule} from "../../../src/ioc/interfaces/modules";

@injectable()
export default class MultisignaturesModuleStub extends BaseStubClass implements IMultisignaturesModule {

    @stubMethod()
    processSignature(tx: { signature: any; transaction: string }): Promise<void> {
        return undefined;
    }


    // TODO Add more methods when needed
}
