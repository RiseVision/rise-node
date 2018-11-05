import { expect } from 'chai';
import * as jsonpath from 'jsonpath';
import * as proxyquire from 'proxyquire';
import 'reflect-metadata';
import * as sinon from 'sinon';
import { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import { AppState } from '../../src';

// tslint:disable no-unused-expression
describe('appState', () => {
  let instance: AppState;
  let valueSpy: SinonSpy;
  let computedStub: SinonStub;
  let sandbox: SinonSandbox;

  const ProxyAppState = proxyquire('../../src/appState', {
    jsonpath,
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    valueSpy = sandbox.spy(jsonpath, 'value');
    instance = new ProxyAppState.AppState();
    computedStub = sandbox.stub().returns('returnVal');
    instance.states = {
      rounds: {
        isLoaded: false,
      },
    };
    instance.computed = {
      poorConsensus: computedStub,
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('set', () => {
    it('should call jsonpath.value with 3 params', () => {
      instance.set('a.b.c.d', 'RISE');
      // cannot test calledOnce because value is internally called responsively
      expect(valueSpy.called).to.be.true;
      expect(valueSpy.firstCall.args.length).to.be.equal(3);
      expect(valueSpy.firstCall.args[1]).to.be.equal('$.a.b.c.d');
      expect(valueSpy.firstCall.args[2]).to.be.equal('RISE');
    });

    it('should set the value in states', () => {
      instance.set('a.b.c.d', 'RISE');
      expect((instance.states as any).a.b.c.d).to.be.equal('RISE');
    });
  });

  describe('setComputed', () => {
    it('should call jsonpath.value with 3 params', () => {
      const fn = () => 'RISE';
      instance.setComputed('a.b.c.d', fn);
      expect(valueSpy.called).to.be.true;
      expect(valueSpy.firstCall.args.length).to.be.equal(3);
      expect(valueSpy.firstCall.args[1]).to.be.equal('$.a.b.c.d');
      expect(valueSpy.firstCall.args[2]).to.be.deep.equal(fn);
    });

    it('should set the value in computed', () => {
      const fn = () => 'RISE';
      instance.setComputed('a.b.c.d', fn);
      expect((instance.computed as any).a.b.c.d).to.be.deep.equal(fn);
    });
  });

  describe('getComputed', () => {
    it('should call jsonpath.value with 2 params', () => {
      instance.getComputed('poorConsensus');
      expect(valueSpy.called).to.be.true;
      expect(valueSpy.firstCall.args.length).to.be.equal(2);
      expect(valueSpy.firstCall.args[1]).to.be.equal('$.poorConsensus');
    });

    it('should return undefined if value is not a function', () => {
      const retVal = instance.getComputed('nonExistingFn');
      expect(retVal).to.be.undefined;
    });

    it('should execute the function and return the result', () => {
      const retVal = instance.getComputed('poorConsensus');
      expect(computedStub.calledOnce).to.be.true;
      expect(retVal).to.be.equal('returnVal');
    });
  });

  describe('get', () => {
    it('should call jsonpath.value with 2 params', () => {
      instance.get('rounds.isLoaded');
      expect(valueSpy.called).to.be.true;
      expect(valueSpy.firstCall.args.length).to.be.equal(2);
      expect(valueSpy.firstCall.args[1]).to.be.equal('$.rounds.isLoaded');
    });

    it('should return the value', () => {
      const retVal = instance.get('rounds.isLoaded');
      expect(retVal).to.be.equal((instance.states as any).rounds.isLoaded);
    });
  });
});
