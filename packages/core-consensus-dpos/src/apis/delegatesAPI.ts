import {
  APISymbols,
  DeprecatedAPIError,
  HTTPError,
  PrivateApisGuard,
} from '@risevision/core-apis';
import { BlocksAPI, BlocksSymbols } from '@risevision/core-blocks';
import { ModelSymbols } from '@risevision/core-models';
import {
  ConstantsType,
  IAccountsModule,
  IBlocksModel,
  IBlocksModule,
  ICrypto,
  ISystemModule,
  ITransactionsModel,
  publicKey,
  Symbols,
} from '@risevision/core-types';
import {
  IoCSymbol,
  OrderBy,
  SchemaValid,
  ValidateSchema,
} from '@risevision/core-utils';
import * as crypto from 'crypto';
import { inject, injectable, named, postConstruct } from 'inversify';
import {
  Body,
  Get,
  JsonController,
  Post,
  Put,
  QueryParam,
  QueryParams,
  UseBefore,
} from 'routing-controllers';
import { Op } from 'sequelize';
import { As } from 'type-tagger';
import * as z_schema from 'z-schema';
import { DposConstantsType, dPoSSymbols, Slots } from '../helpers/';
import { Accounts2DelegatesModel, AccountsModelForDPOS } from '../models';
import { BaseDelegateData, DelegatesModule, ForgeModule } from '../modules';

// tslint:disable-next-line
const schema = require('../../schema/delegates.json');
// tslint:disable max-line-length
@JsonController('/api/delegates')
@injectable()
@IoCSymbol(dPoSSymbols.delegatesAPI)
export class DelegatesAPI {
  // other apis
  @inject(APISymbols.class)
  @named(BlocksSymbols.api.api)
  public blocksAPI: BlocksAPI;

  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(dPoSSymbols.constants)
  public dposConstants: DposConstantsType;
  @inject(Symbols.generic.constants)
  public constants: ConstantsType;
  @inject(Symbols.modules.accounts)
  private accounts: IAccountsModule<AccountsModelForDPOS>;
  @inject(Symbols.modules.blocks)
  private blocks: IBlocksModule;
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;
  @inject(Symbols.generic.crypto)
  private crypto: ICrypto;
  @inject(dPoSSymbols.modules.forge)
  private forgeModule: ForgeModule;
  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;
  @inject(Symbols.modules.system)
  private system: ISystemModule;

  // models
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModelForDPOS;
  @inject(ModelSymbols.model)
  @named(Symbols.models.blocks)
  private BlocksModel: typeof IBlocksModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.transactions)
  private TransactionsModel: typeof ITransactionsModel;

  @postConstruct()
  public postConstruct() {
    schema.getDelegates.properties.limit.maximum =
      this.dposConstants.dposv2.firstBlock > 0
        ? this.dposConstants.dposv2.delegatesPoolSize
        : this.dposConstants.activeDelegates;
  }

  @Get('/rewards')
  @ValidateSchema()
  public async rewards(@SchemaValid(schema.getRewards, { castNumbers: true })
  @QueryParams()
  params: {
    username: string;
    from: number;
    to: number;
  }) {
    const r = await this.delegatesModule.getDelegate(params.username);
    if (!r) {
      throw new HTTPError('Delegate not found', 404);
    }
    const forgingKeys = await this.delegatesModule.loadForgingPKByDelegate(
      r.account.address
    );

    const rewards = [];
    for (const fk of forgingKeys) {
      rewards.push({
        forgingKey: fk.forgingPK.toString('hex'),
        fromHeight: fk.height,
        ...(await this.blocksAPI.getRewards({
          from: params.from,
          generator: fk.forgingPK.toString('hex') as string & As<'publicKey'>,
          to: params.to,
        })),
      });
    }
    const cumulative = rewards
      .map((a) => ({ ...a, fees: BigInt(a.fees), rewards: BigInt(a.rewards) }))
      .reduceRight(
        (a, b) => {
          return {
            fees: a.fees + b.fees,
            rewards: a.rewards + b.rewards,
            totalBlocks: a.totalBlocks + b.totalBlocks,
          };
        },
        { fees: 0n, rewards: 0n, totalBlocks: 0 }
      );
    return { cumulative, details: rewards };
  }

  @Get('/')
  @ValidateSchema()
  public async getDelegates(@SchemaValid(schema.getDelegates, {
    castNumbers: true,
  })
  @QueryParams()
  data: {
    orderBy: string;
    limit: number;
    offset: number;
  }) {
    const delegates: Array<
      BaseDelegateData & { infos?: any }
    > = await this.delegatesModule.getDelegates(data);
    for (const d of delegates) {
      d.infos = await this.delegatesModule.calcDelegateInfo(d, delegates);
    }
    return {
      delegates: OrderBy(data.orderBy)(delegates).slice(
        0,
        data.limit || Number.MAX_SAFE_INTEGER
      ),
    };
  }

  @Get('/fee')
  @ValidateSchema()
  public async getFee(@SchemaValid(schema.getFee, { castNumbers: true })
  @QueryParams()
  params: {
    height?: number;
  }) {
    const f = this.system.getFees(params.height);
    const { delegate } = f.fees;
    delete f.fees;
    return { ...f, ...{ fee: delegate } };
  }

  @Get('/get')
  @ValidateSchema()
  public async getDelegate(@SchemaValid(schema.getDelegate)
  @QueryParams()
  params: {
    username: string;
  }) {
    const r = await this.delegatesModule.getDelegate(params.username);
    if (!r) {
      throw new HTTPError('Delegate not found', 404);
    }
    return {
      ...r,
      account: {
        address: r.account.address,
        balance: r.account.balance,
        cmb: r.account.cmb,
        missedBlocks: r.account.missedblocks,
        producedBlocks: r.account.producedblocks,
        rewards: r.account.rewards,
        username: r.account.username,
        vote: r.account.vote,
        votesWeight: r.account.votesWeight,
      },
      info: await this.delegatesModule.calcDelegateInfo(r.account),
    };
  }

  @Get('/voters')
  @ValidateSchema()
  public async getVoters(@SchemaValid(schema.getVoters)
  @QueryParams()
  params: {
    username: string;
  }) {
    const rows = await this.Accounts2DelegatesModel.findAll({
      attributes: ['address'],
      raw: true,
      where: { username: params.username },
    });
    const addresses = rows.map((r) => r.address);

    const voters = await this.AccountsModel.scope(null).findAll({
      attributes: ['address', 'balance'],
      order: [['balance', 'DESC']],
      raw: true,
      where: {
        address: { [Op.in]: addresses },
      },
    });
    return { voters };
  }

  @Get('/search')
  @ValidateSchema()
  public async search(@SchemaValid(schema.search, { castNumbers: true })
  @QueryParams()
  params: {
    q: string;
    limit?: number;
    orderBy?: string;
  }) {
    const results = await this.AccountsModel.scope(null).findAll({
      attributes: [
        'address',
        'cmb',
        'forgingPK',
        'username',
        'vote',
        'votesWeight',
        'producedblocks',
        'missedblocks',
      ],
      // limit: params.limit,
      order: [['votesWeight', 'DESC']],
      raw: true,
      where: { username: { [Op.like]: `%${params.q}%` } },
    });
    const delegates = await this.delegatesModule.getDelegates();

    for (const d of results) {
      (d as any).infos = await this.delegatesModule.calcDelegateInfo(
        d,
        delegates
      );
    }

    return {
      delegates: OrderBy(params.orderBy)(results).slice(
        0,
        params.limit || Number.MAX_SAFE_INTEGER
      ),
    };
  }

  @Get('/count')
  public async count() {
    return { count: await this.Accounts2DelegatesModel.count() };
  }

  @Get('/getNextForgers')
  public async getNextForgers(
    @QueryParam('limit', { required: false }) limit: number = 10
  ) {
    const curBlock = this.blocks.lastBlock;

    const activeDelegates = await this.delegatesModule.generateDelegateList(
      curBlock.height
    );

    const currentBlockSlot = this.slots.getSlotNumber(curBlock.timestamp);
    const currentSlot = this.slots.getSlotNumber();
    const nextForgers: string[] = [];
    for (let i = 1; i <= this.slots.delegates && i <= limit; i++) {
      // This if looks a bit stupid to me.
      if (activeDelegates[(currentSlot + i) % this.slots.delegates]) {
        nextForgers.push(
          activeDelegates[(currentSlot + i) % this.slots.delegates].toString(
            'hex'
          )
        );
      }
    }

    return {
      currentBlock: this.BlocksModel.toStringBlockType(curBlock),
      currentBlockSlot,
      currentSlot,
      delegates: nextForgers,
    };
  }

  @Put('/')
  public async createDelegate() {
    throw new DeprecatedAPIError();
  }

  // internal stuff.
  @Get('/forging/status')
  @ValidateSchema()
  @UseBefore(PrivateApisGuard)
  public async getForgingStatus(@SchemaValid(schema.forgingStatus)
  @QueryParams()
  params: {
    publicKey: publicKey;
  }) {
    if (params.publicKey) {
      return {
        delegates: [params.publicKey],
        enabled: this.forgeModule.isForgeEnabledOn(params.publicKey),
      };
    } else {
      const delegates = this.forgeModule.getEnabledKeys();
      return {
        delegates,
        enabled: delegates.length > 0,
      };
    }
  }

  @Post('/forging/enable')
  @ValidateSchema()
  @UseBefore(PrivateApisGuard)
  public async forgingEnable(@SchemaValid(schema.disableForging)
  @Body()
  params: {
    secret: string;
    publicKey: string;
  }) {
    const kp = this.crypto.makeKeyPair(
      crypto
        .createHash('sha256')
        .update(params.secret, 'utf8')
        .digest()
    );

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new HTTPError('Invalid passphrase', 200);
    }

    if (this.forgeModule.isForgeEnabledOn(pk)) {
      throw new HTTPError('Forging is already enabled', 200);
    }

    const account = await this.accounts.getAccount({
      forgingPK: kp.publicKey as Buffer & As<'publicKey'>,
    });
    if (!account) {
      throw new HTTPError('Account not found', 200);
    }

    this.forgeModule.enableForge(kp);
  }

  @Post('/forging/disable')
  @ValidateSchema()
  @UseBefore(PrivateApisGuard)
  public async forgingDisable(@SchemaValid(schema.disableForging)
  @Body()
  params: {
    secret: string;
    publicKey: string;
  }) {
    const kp = this.crypto.makeKeyPair(
      crypto
        .createHash('sha256')
        .update(params.secret, 'utf8')
        .digest()
    );

    const pk = kp.publicKey.toString('hex');
    if (params.publicKey && pk !== params.publicKey) {
      throw new HTTPError('Invalid passphrase', 200);
    }

    if (!this.forgeModule.isForgeEnabledOn(pk)) {
      throw new HTTPError('Forging is already disabled', 200);
    }

    const account = await this.accounts.getAccount({
      forgingPK: kp.publicKey as Buffer & As<'publicKey'>,
    });
    if (!account) {
      throw new HTTPError('Account not found', 200);
    }

    this.forgeModule.disableForge(pk);
  }
}
