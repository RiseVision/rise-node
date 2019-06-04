import { APISymbols } from '@risevision/core-apis';
import { BlocksAPI, BlocksSymbols } from '@risevision/core-blocks';
import { Address, Symbols } from '@risevision/core-types';
import { IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { inject, injectable, named } from 'inversify';
import { Get, JsonController, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { KeystoreModule } from '../modules/keystoreModule';
import { KeystoreTxSymbols } from '../symbols';

// tslint:disable-next-line
const schema = require('../../schema/api.json');
// tslint:disable max-line-length
@JsonController('/api/keystore')
@injectable()
@IoCSymbol(KeystoreTxSymbols.api)
export class KeystoreAPI {
  // other apis
  @inject(APISymbols.class)
  @named(BlocksSymbols.api.api)
  public blocksAPI: BlocksAPI;

  @inject(Symbols.generic.zschema)
  public schema: z_schema;

  @inject(KeystoreTxSymbols.module)
  private keystoreModule: KeystoreModule;

  @Get('/history')
  @ValidateSchema()
  public async history(@SchemaValid(schema.getHistory)
  @QueryParams()
  params: {
    address: Address;
  }) {
    const res = await this.keystoreModule.getAllAcctValues(params.address);
    return { history: res.history };
  }

  @Get('/current')
  @ValidateSchema()
  public async current(@SchemaValid(schema.getCurrent)
  @QueryParams()
  data: {
    address: Address;
  }) {
    const res = await this.keystoreModule.getAllAcctValues(data.address);
    return { current: res.current };
  }
}
