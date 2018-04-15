import * as chai from 'chai';
import * as proxyquire from 'proxyquire';
import * as chaiAsPromised from 'chai-as-promised';
import 'reflect-metadata';
import { SinonSpy } from 'sinon';
import * as sinon from 'sinon';
import * as z_schema from 'z-schema';

const { expect } = chai;
chai.use(chaiAsPromised);
const helpersStub = {} as any;
const ProxySchemaValidators = proxyquire('../../../../src/helpers/decorators/schemavalidators', {
  '../': helpersStub,
});
const { SchemaValid, ValidateSchema } = ProxySchemaValidators;

describe('helpers/decorators', () => {

  describe('SchemaValid', () => {

    // Schemas:
    const nonEmptyString = { type: 'string', minLength: 1 };
    const integerNumber = { type: 'integer' };

    class TestUtil {
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
    }

    it('should attach __schema metadata to the method', () => {
      class TestCase extends TestUtil {
        // One param, validated with nonEmptyString schema
        public method(@SchemaValid(nonEmptyString) param: string) {
          return param;
        }
      }
      const instance = new TestCase();
      const metadata = instance.get_metadata('method');
      expect(metadata).to.be.an('array');
      expect(metadata.length).to.be.eq(1);
    });

    it('should include the schema definition in the method __schema metadata', () => {
      class TestCase extends TestUtil {
        // One param, validated with nonEmptyString schema
        public method(@SchemaValid(nonEmptyString) param: string) {
          return param;
        }
      }
      const instance = new TestCase();
      const metadata = instance.get_metadata_with_index('method', 0);
      expect(metadata.obj).to.be.deep.eq(nonEmptyString);
    });

    it('should add a number of metadata objects === the number of decorated parameters of the method', () => {
      class TestCase extends TestUtil {
        // 3 params, 2 validated with nonEmptyString and integerNumber schemas
        public method(@SchemaValid(nonEmptyString) param: string,
                      @SchemaValid(integerNumber) param2: number,
                      nonDecoratedParam: string) {
          return param;
        }
      }
      const instance = new TestCase();
      const metadata = instance.get_metadata('method');
      expect(metadata.length).to.be.eq(2);
      expect(instance.get_metadata_with_index('method', 0).obj).to.be.deep.eq(nonEmptyString);
      expect(instance.get_metadata_with_index('method', 1).obj).to.be.deep.eq(integerNumber);
    });

    it('should include the errorString and castNumbers properties in metadata items when provided', () => {
      class TestCase extends TestUtil {
        // Decorator is specified with both errorString and castNumbers
        public method(@SchemaValid(nonEmptyString, {errorString: 'RISEError', castNumbers: true}) param: string)  {
          return param;
        }
      }
      const instance = new TestCase();
      const metadata = instance.get_metadata('method');
      expect(metadata[0].opts.errorString).to.be.eq('RISEError');
      expect(metadata[0].opts.castNumbers).to.be.eq(true);
    });

    it('should allow passing the errorString as second parameter of the decorator', () => {
      class TestCase extends TestUtil {
        // Decorator is specified with a plain error string
        public method(@SchemaValid(nonEmptyString, 'RISEError4') param: string)   {
          return param;
        }
      }
      const instance = new TestCase();
      const metadata = instance.get_metadata('method');
      expect(metadata[0].opts.errorString).to.be.eq('RISEError4');
    });
  });

  describe('ValidateSchema', () => {
    // Schemas:
    const nonEmptyString = { type: 'string', minLength: 1 };
    const simpleObject = {
      type      : 'object',
      properties: {
        str: {
          type     : 'string',
          minLength: 1,
        },
        num: {
          type: 'integer',
        },
      },
    };

    class TestUtil {
      public schema: z_schema;
      public validateSpy: SinonSpy;

      constructor() {
        this.schema = new z_schema({});
        this.validateSpy = sinon.spy(this.schema, 'validate');
      }
    }

    it('should validate passed parameters with schema and continue function execution if validation is OK', async () => {
      class TestCase extends TestUtil {
        @ValidateSchema()
        public method(@SchemaValid(nonEmptyString) param: string, executionSpy: SinonSpy) {
          executionSpy();
          return param;
        }
      }
      const instance = new TestCase();
      const executionSpy = sinon.spy();
      // Passing a valid value
      await instance.method('test', executionSpy);
      expect(instance.validateSpy.called).to.be.true;
      expect(executionSpy.called).to.be.true;
    });

    it('should throw an error and stop execution if validation is KO', async () => {
      class TestCase extends TestUtil {
        @ValidateSchema()
        public async method(@SchemaValid(nonEmptyString) param: string, executionSpy: SinonSpy) {
          executionSpy();
          return param;
        }
      }
      const instance = new TestCase();
      const executionSpy = sinon.spy();
      await expect(instance.method('', executionSpy)).to.rejectedWith(Error);
      expect(executionSpy.called).to.be.false;
    });

    it('should throw an error with the right message when specified in metadata', async () => {
      class TestCase extends TestUtil {
        @ValidateSchema()
        public async method(@SchemaValid(nonEmptyString, 'RISEError6') param: string) {
          return param;
        }
      }
      const instance = new TestCase();;
      await expect(instance.method('')).to.rejectedWith(/^RISEError6$/);
    });

    it('should call castFieldsToNumberUsingSchema if specified in metadata', async () => {
      class TestCase extends TestUtil {
        @ValidateSchema()
        public async method(@SchemaValid(simpleObject, {castNumbers: true}) param: any) {
          return param;
        }
      }
      const castSpy = sinon.spy();
      helpersStub.castFieldsToNumberUsingSchema = castSpy;
      const instance = new TestCase();
      // Passing a valid value
      instance.method({ str: 'RISE', num: 42 });
      expect(castSpy.called).to.be.true;
    });

    it('should reject the promise if method is returning a promise', async () => {
      class TestCase extends TestUtil {
        @ValidateSchema()
        public async method(@SchemaValid(nonEmptyString, 'RISEError8') param: string) {
          return param;
        }
      }
      const instance = new TestCase();
      let error: Error;
      try {
        // Passing an invalid value
        await instance.method('');
      } catch (e) {
        error = e;
      }
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.be.eq('RISEError8');
    });
  });

});
