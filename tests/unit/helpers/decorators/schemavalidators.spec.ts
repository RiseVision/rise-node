import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'reflect-metadata';
import * as rewire from 'rewire';
import { SinonSpy } from 'sinon';
import * as sinon from 'sinon';
import * as z_schema from 'z-schema';
import { SchemaValid, ValidateSchema } from '../../../../src/helpers/decorators/schemavalidators';

const { expect } = chai;
chai.use(chaiAsPromised);

const rewired = rewire('../../../../src/helpers/decorators/schemavalidators');
const mySchema = {
  str: {
    type: 'string',
    minLength: 1,
  },
  num: {
    type: 'integer',
  },
  obj: {
    type      : 'object',
    properties: {
      str: {
        type     : 'string',
        minLength: 1,
        maxLength: 100,
      },
      num: {
        type: 'integer',
      },
    },
    required  : ['str'],
  },
};

class SchemavalidatorsTestClass {
  public schema: z_schema;

  constructor() {
    this.schema = new z_schema( {});
  }

  // Returns metadata for a specific method
  public get_metadata(method: string, key = '__schema'): any[] | undefined {
    return Reflect.getMetadata(key, this, method);
  }

  // Returns metadata for a specific method, including only the object with the passed index
  public get_metadata_with_index(method: string, index: number, key = '__schema') {
    const metadata = this.get_metadata(method, key);
    const filtered = metadata.filter((item) => {
      return item.index === index;
    });
    return filtered.shift();
  }

  // Injects a SinonSpy inside z_schema.validate and returns it
  public get_validate_spy(): SinonSpy {
    const spy = sinon.spy();
    const oldFn = this.schema.validate;
    this.schema.validate = (...args) => {
      spy();
      return oldFn.apply(this.schema, args);
    };
    return spy;
  }

  // One param, validated with mySchema.str
  public method_1(@SchemaValid(mySchema.str) param: string) {
    return param;
  }

  // Two params, validated with mySchema.str and mySchema.num
  public method_2(@SchemaValid(mySchema.str) param: string,
                  @SchemaValid(mySchema.num) param2: number,
                  nonDecoratedParam: string ) {
    return {param, param2, nonDecoratedParam};
  }

  // Decorator is specified with both errorString and castNumbers
  public method_3(@SchemaValid(mySchema.str, {errorString: 'RISEError', castNumbers: true}) param: string) {
    return param;
  }

  // Decorator is specified with a plain error string
  public method_4(@SchemaValid(mySchema.str, 'RISEError4') param: string) {
    return param;
  }

  // Spy is supposed to be executed only if decorator doesn't prevent it
  @ValidateSchema()
  public method_5(@SchemaValid(mySchema.str) param: string, executionSpy: SinonSpy) {
    executionSpy();
    return param;
  }

  // Validation error specified
  @ValidateSchema()
  public method_6(@SchemaValid(mySchema.str, 'RISEError6') param: string) {
    return param;
  }

  // Cast Numbers requested
  @ValidateSchema()
  public method_7(@SchemaValid(mySchema.obj, {castNumbers: true}) param: any) {
    return param;
  }

  // Cast Numbers requested
  @ValidateSchema()
  public method_8(@SchemaValid(mySchema.str, 'RISEError8') param: string): Promise<void> {
    return Promise.resolve();
  }
}

describe('helpers/decorators', () => {

  const inst = new SchemavalidatorsTestClass();

  describe('SchemaValid', () => {
    it('should attach __schema metadata to the method', () => {
      const metadata = inst.get_metadata('method_1');
      expect(metadata).to.be.an('array');
      expect(metadata.length).to.be.eq(1);
    });

    it('should include the schema definition in the method __schema metadata', () => {
      const metadata = inst.get_metadata_with_index('method_1', 0);
      expect(metadata.obj).to.be.deep.eq(mySchema.str);
    });

    it('should add a number of metadata objects === the number of decorated parameters of the method', () => {
      const metadata = inst.get_metadata('method_2');
      expect(metadata.length).to.be.eq(2);
      expect(inst.get_metadata_with_index('method_2', 0).obj).to.be.deep.eq(mySchema.str);
      expect(inst.get_metadata_with_index('method_2', 1).obj).to.be.deep.eq(mySchema.num);
    });

    it('should include the errorString and castNumbers properties in metadata items when provided', () => {
      const metadata = inst.get_metadata('method_3');
      expect(metadata[0].opts.errorString).to.be.eq('RISEError');
      expect(metadata[0].opts.castNumbers).to.be.eq(true);
    });

    it('should allow passing the errorString as second parameter of the decorator', () => {
      const metadata = inst.get_metadata('method_4');
      expect(metadata[0].opts.errorString).to.be.eq('RISEError4');
    });
  });

  describe('ValidateSchema', () => {
    it('should validate passed parameters with schema and continue function execution if validation is OK', () => {
      const executionSpy = sinon.spy();
      const validateSpy = inst.get_validate_spy();
      inst.method_5('test', executionSpy);
      expect(validateSpy.called).to.be.true;
      expect(executionSpy.called).to.be.true;
    });

    it('should throw an error and stop execution if validation is KO', () => {
      const executionSpy = sinon.spy();
      expect(() => {
        // Passing an empty string, validator requires a string long >= 1
        inst.method_5('', executionSpy);
      }).to.throw(Error);
      expect(executionSpy.called).to.be.false;
    });

    it('should throw an error with the right message when specified in metadata', () => {
      expect(() => {
        // Passing an empty string, validator requires a string long >= 1
        inst.method_6('');
      }).to.throw(Error, /^RISEError6$/);
    });

    it('should call castFieldsToNumberUsingSchema if specified in metadata', () => {
      const oldCastFn = rewired.__get__('_1.castFieldsToNumberUsingSchema');
      const castSpy = sinon.spy();
      rewired.__set__('_1.castFieldsToNumberUsingSchema', (schema: any, obj: any) => {
        castSpy();
        return oldCastFn(schema, obj);
      });
      inst.method_7({ str: 'RISE', num: '12' });
      rewired.__set__('_1.castFieldsToNumberUsingSchema', oldCastFn);
      expect(castSpy.called).to.be.true;
    });

    it('should reject the promise if method is returning a promise', async () => {
      let error: Error;
      try {
        await inst.method_8('');
      } catch (e) {
        error = e;
      }
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.be.eq('RISEError8');
    });
  });

});
