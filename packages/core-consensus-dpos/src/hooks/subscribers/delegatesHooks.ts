import { OnCheckIntegrity } from '@risevision/core';
import { AccountsSymbols } from '@risevision/core-accounts';
import { VerifyBlock, VerifyReceipt } from '@risevision/core-blocks';
import { Symbols } from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { ConstantsType, SignedBlockType } from '@risevision/core-types';
import * as fs from 'fs';
import { decorate, inject, injectable, named } from 'inversify';
import { WordPressHookSystem, WPHooksSubscriber } from 'mangiafuoco';
import * as sequelize from 'sequelize';
import { dPoSSymbols, Slots } from '../../helpers';
import { AccountsModelForDPOS, DelegatesModel } from '../../models';
import { DelegatesModule } from '../../modules';

const countDuplicatedDelegatesSQL = fs.readFileSync(
  `${__dirname}/../../../sql/countDuplicatedDelegates.sql`,
  { encoding: 'utf8' }
);

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

  @inject(dPoSSymbols.helpers.slots)
  private slots: Slots;

  @inject(Symbols.generic.constants)
  private constants: ConstantsType;

  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;

  @OnCheckIntegrity()
  private async checkLoadingIntegrity(totalBlocks: number) {
    const delegatesCount = await this.accountsModel.count({
      where: { isDelegate: 1 },
    });
    if (delegatesCount === 0) {
      throw new Error('No delegates found');
    }
    const [duplicatedDelegates] = await this.delegatesModel.sequelize.query(
      countDuplicatedDelegatesSQL,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (duplicatedDelegates.count > 0) {
      throw new Error('Delegates table corrupted with duplicated entries');
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
      slotNumber > this.slots.getSlotNumber(this.slots.getTime()) ||
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
    if (curSlot - blockSlot > this.constants.blockSlotWindow) {
      errors.push('Block slot is too old');
    }
    if (curSlot < blockSlot) {
      errors.push('Block slot is in the future');
    }
    payload.errors = errors;
    payload.verified = errors.length === 0;
    return payload;
  }
}
