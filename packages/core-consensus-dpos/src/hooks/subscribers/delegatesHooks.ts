import { OnCheckIntegrity, RecreateAccountsTables } from '@risevision/core';
import { AccountsSymbols } from '@risevision/core-accounts';
import {
  ApplyBlockDBOps,
  BlocksConstantsType,
  BlocksSymbols,
  RollbackBlockDBOps,
  VerifyBlock,
  VerifyReceipt,
} from '@risevision/core-blocks';
import { ModelSymbols } from '@risevision/core-models';
import {
  ConstantsType,
  DBOp,
  ILogger,
  SignedAndChainedBlockType,
  SignedBlockType,
  Symbols,
} from '@risevision/core-types';
import { catchToLoggerAndRemapError } from '@risevision/core-utils';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import { dPoSSymbols, Slots } from '../../helpers';
import { DposConstantsType } from '../../helpers';
import {
  AccountsModelForDPOS,
  DelegatesModel,
  DelegatesRoundModel,
} from '../../models';
import { DelegatesModule } from '../../modules';

const Extendable = WPHooksSubscriber(Object);
decorate(injectable(), Extendable);

@injectable()
export class DelegatesHooks extends Extendable {
  @inject(Symbols.generic.hookSystem)
  public hookSystem: WordPressHookSystem;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegates)
  private delegatesModel: typeof DelegatesModel;
  @inject(ModelSymbols.model)
  @named(AccountsSymbols.model)
  private accountsModel: typeof AccountsModelForDPOS;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.delegatesRound)
  private delegatesRoundModel: typeof DelegatesRoundModel;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;

  @inject(BlocksSymbols.constants)
  private blocksConstants: BlocksConstantsType;

  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;

  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;

  @OnCheckIntegrity()
  private async checkLoadingIntegrity(totalBlocks: number) {
    const delegatesCount = await this.accountsModel.count({
      where: { isDelegate: 1 },
    });
    if (delegatesCount === 0) {
      throw new Error('No delegates found');
    }
  }

  /**
   * Verifies through a filter that the given block is not in the past compared to last block
   * and not in the future compared to now.
   */
  @VerifyBlock(9)
  private async verifyBlockSlot(
    payload: { errors: string[]; verified: boolean },
    block: SignedBlockType,
    lastBlock: SignedBlockType
  ) {
    if (!payload.verified) {
      return payload;
    }
    const slotNumber = this.slots.getSlotNumber(block.timestamp);
    const lastSlot = this.slots.getSlotNumber(lastBlock.timestamp);

    if (
      slotNumber >
        this.slots.getSlotNumber(
          this.slots.getTime() + this.dposConstants.timeDriftCorrection
        ) ||
      slotNumber <= lastSlot
    ) {
      // if in future or in the past => error
      payload.errors.push('Invalid block timestamp');
      payload.verified = false;
    }
    return payload;
  }

  /**
   * Verifies that the block has been forged by the correct delegate.
   */
  @VerifyBlock(100)
  @VerifyReceipt(100)
  private async verifyBlock(
    payload: { errors: string[]; verified: boolean },
    block: SignedBlockType
  ) {
    if (!payload.verified) {
      return payload;
    }
    try {
      await this.delegatesModule.assertValidBlockSlot(block);
      return payload;
    } catch (e) {
      payload.errors.push(e.message);
      payload.verified = false;
      return payload;
    }
  }

  /**
   * Verify block slot is not too in the past or in the future.
   */
  @VerifyReceipt()
  private async verifyBlockSlotWindow(
    payload: { errors: string[]; verified: boolean },
    block: SignedBlockType
  ) {
    if (!payload.verified) {
      return payload;
    }
    const curSlot = this.slots.getSlotNumber();
    const blockSlot = this.slots.getSlotNumber(block.timestamp);
    const errors = [];
    if (curSlot - blockSlot > this.blocksConstants.slotWindow) {
      errors.push('Block slot is too old');
    }
    if (curSlot < blockSlot) {
      errors.push('Block slot is in the future');
    }
    payload.errors = errors;
    payload.verified = errors.length === 0;
    return payload;
  }

  @ApplyBlockDBOps()
  private async onApplyBlockDBOpsFilter(
    dbOP: Array<DBOp<any>>,
    block: SignedAndChainedBlockType
  ) {
    await this.delegatesModule.onBlockChanged('forward', block.height);
    return dbOP;
  }

  @RollbackBlockDBOps()
  private async onRollbackBlockDBOpsFilter(
    dbOP: Array<DBOp<any>>,
    block: SignedAndChainedBlockType,
    prevBlock: SignedAndChainedBlockType
  ) {
    await this.delegatesModule.onBlockChanged('backward', prevBlock.height);
    return dbOP;
  }

  @RecreateAccountsTables()
  private async recreateTables(): Promise<void> {
    await this.delegatesRoundModel
      .truncate({ cascade: true })
      .catch(
        catchToLoggerAndRemapError(
          'DelegatesRoundModel#removeTables error',
          this.logger
        )
      );
  }
}
