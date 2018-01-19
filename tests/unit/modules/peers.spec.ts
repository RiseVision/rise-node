import { expect } from 'chai';
import 'chai-as-promised';
import { Container } from 'inversify';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { constants as constantsType } from '../../../src/helpers/';
import { IPeersModule, ISystemModule } from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { PeersModule, SystemModule } from '../../../src/modules';
import { BusStub, DbStub, IBlocksStub, LoggerStub, PeersLogicStub } from '../../stubs';
import SystemModuleStub from '../../stubs/modules/SystemModuleStub';
import { BaseStubClass } from '../../stubs/BaseStubClass';

// tslint:disable no-unused-expression
describe('modules/peers', () => {


});
