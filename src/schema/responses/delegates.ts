import {
  wholeNum,
  amount,
  height,
  stringnum,
  address,
  username,
  publicKey
} from "../common/scalars";
import { Delegate, Block } from "../common/models";
import { successResp, respProps } from "../utils/responses";
import { scope } from '../utils/scope'

const s = scope('responses.delegates')

export default {
  getDelegates: {
    id: s`getDelegates`,
    type: "object",
    properties: respProps({
      delegates: {
        type: "array",
        items: Delegate
      },
      totalCount: wholeNum
    }),
    example: successResp({
      delegates: [
        {
          address: "8093718274007724701R",
          username: "official_pool",
          publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0",
          vote: "325086457459378",
          producedblocks: 13268,
          missedblocks: 30,
          rate: 1,
          rank: 1,
          approval: 2.51,
          productivity: 99.77
        },
        {
          address: "3262489507414775391R",
          username: "jan",
          publicKey: "e433144892f40c838d0ea865dde0915e4fdaecf3521efef585ff306e6513c8fc",
          vote: "206316281125264",
          producedblocks: 13175,
          missedblocks: 36,
          rate: 2,
          rank: 2,
          approval: 1.59,
          productivity: 99.73
        },
        {
          address: "18103881046813301656R",
          username: "trnpallypool",
          publicKey: "029c5489b5e3f7951028b07c2665dedc2072c5454982b945e8d4a24e6a789828",
          vote: "179239667188718",
          producedblocks: 12032,
          missedblocks: 15,
          rate: 3,
          rank: 3,
          approval: 1.38,
          productivity: 99.88
        }
      ],
      totalCount: 893
    })
  },
  getFee: {
    id: s`getFee`,
    type: "object",
    properties: respProps({
      fee: amount,
      fromHeight: height,
      toHeight: height,
      height
    }),
    example: successResp({
      fromHeight: 1,
      height: 1356762,
      toHeight: null,
      fee: 2500000000
    })
  },
  getForgedByAccount: {
    id: s`getForgedByAccount`,
    type: "object",
    properties: respProps({
      fees: amount,
      forged: stringnum,
      rewards: amount
    }),
    example: successResp({
      fees: 81373069039,
      forged: "17052373069039",
      rewards: 16971000000000
    })
  },
  getDelegate: {
    id: s`getDelegate`,
    type: "object",
    properties: respProps({
      delegate: Delegate
    }),
    example: successResp({
      delegate: {
        address: "8093718274007724701R",
        username: "official_pool",
        publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0",
        vote: "325086457459378",
        producedblocks: 13268,
        missedblocks: 30,
        rate: 1,
        rank: 1,
        approval: 2.51,
        productivity: 99.77
      }
    })
  },
  getVoters: {
    id: s`getVoters`,
    type: "object",
    properties: respProps({
      accounts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            address,
            balance: amount,
            username,
            publicKey
          }
        }
      }
    }),
    example: successResp({
      accounts: [
        {
          address: "9255027573703699506R",
          balance: 10,
          username: "coolguy",
          publicKey: "248fe3d613f5f110bd12ac55c90f8bd8e3a018c15dee6c0fdaf4dd6b711a670f"
        },
        {
          address: "6515902227625427085R",
          balance: 0,
          username: null,
          publicKey: "597ffe0c6bdc5a9ef4c0eed6377326f173059af24fd049df63b339bc22a9f928"
        },
        {
          address: "10101597481712370665R",
          balance: 12,
          username: null,
          publicKey: "6703661ecd198003366a20c7308c5eafcf85377949af970e375486093938e01a"
        }
      ]
    })
  },
  search: {
    id: s`search`,
    type: "object",
    properties: respProps({
      delegates: {
        type: "array",
        items: Delegate
      }
    }),
    example: successResp({
      delegates: [
        {
          address: "8093718274007724701R",
          username: "official_pool",
          publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0",
          vote: "325086457459378",
          producedblocks: 13268,
          missedblocks: 30,
          rate: 1,
          rank: 1,
          approval: 2.51,
          productivity: 99.77
        },
        {
          address: "18103881046813301656R",
          username: "trnpallypool",
          publicKey: "029c5489b5e3f7951028b07c2665dedc2072c5454982b945e8d4a24e6a789828",
          vote: "179239667188718",
          producedblocks: 12032,
          missedblocks: 15,
          rate: 3,
          rank: 3,
          approval: 1.38,
          productivity: 99.88
        }
      ]
    })
  },
  count: {
    id: s`count`,
    type: "object",
    properties: respProps({
      count: wholeNum
    }),
    example: successResp({
      count: 5237
    })
  },
  getNextForgers: {
    id: s`getNextForgers`,
    type: "object",
    properties: respProps({
      currentBlock: Block,
      currentBlockSlot: wholeNum,
      currentSlot: wholeNum,
      delegates: {
        type: "array",
        items: publicKey
      }
    }),
    example: successResp({
      currentBlock: {
        id: "7608930088168657394",
        blockSignature: "058b9e59e6db9a68576faea657dd0971c1dfe86b6f3cfec796481a1e815ecbb559e1026ece9b0daac3a24579311af548edb47632f3ed76effe0fd5c8a6743905",
        generatorPublicKey: "37831fe92d110d1279b02528ca95d89bcfd486ddf465660924eb2e103acd964d",
        height: 1356718,
        numberOfTransactions: 0,
        payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        payloadLength: 0,
        previousBlock: "4446098730403296147",
        reward: 1200000000,
        timestamp: 74389770,
        totalAmount: 0,
        totalFee: 0,
        version: 0,
        transactions: []
      },
      currentBlockSlot: 2479659,
      currentSlot: 2479659,
      delegates: [
        "df06ac715314397ae7736d0ad448c6524dc89752ee41147bc6b7dd44948bd8b1",
        "976b9f0c87004fee662de6bdccdbe22125a0de04cb4692ead9c713bd4a201380",
        "0b7bb40385c5261c8cc763babebc9ccf9d392e618dc15104db5efb1c6a5719ee",
        "1413fc21fb3caa48a934b81e04f4a57b8e4042c255f3738135e1e4803dd146cb",
        "b481e38ca5ac6d4db9ad220306d451614aa1603419451d5eaf1eb49db00f18a4",
        "25b51a18f6e90d8436ee1b5ec67cf9eaaf4273d0f9501e7f42e185e8fbd36033",
        "da03aa8bd684eb0b9c62206e284d74e9361d4a2fb8e90c6ee0bd31b79ff56f3f",
        "0134394f4789bade973b36d4c4302eb9156b56a1723f4d4a8e150805a2be583e",
        "ef3c4554a4ab9e581c88d8b4826eff955dde027239b4899304552d83d20dc897",
        "05e5b4cbe7aa75eaf80cca6a085a35f5f20be68e1d08b98b1dd32b2c108fc328"
      ]
    })
  },
  getForgingStatus: {
    id: s`getForgingStatus`,
    type: "object",
    properties: respProps({
      enabled: { type: "boolean" },
      delegates: {
        type: "array",
        items: publicKey
      }
    }),
    example: successResp({
      enabled: true,
      delegates: [
        "df06ac715314397ae7736d0ad448c6524dc89752ee41147bc6b7dd44948bd8b1",
        "976b9f0c87004fee662de6bdccdbe22125a0de04cb4692ead9c713bd4a201380",
        "0b7bb40385c5261c8cc763babebc9ccf9d392e618dc15104db5efb1c6a5719ee",
        "1413fc21fb3caa48a934b81e04f4a57b8e4042c255f3738135e1e4803dd146cb",
        "b481e38ca5ac6d4db9ad220306d451614aa1603419451d5eaf1eb49db00f18a4",
        "25b51a18f6e90d8436ee1b5ec67cf9eaaf4273d0f9501e7f42e185e8fbd36033",
        "da03aa8bd684eb0b9c62206e284d74e9361d4a2fb8e90c6ee0bd31b79ff56f3f",
        "0134394f4789bade973b36d4c4302eb9156b56a1723f4d4a8e150805a2be583e",
        "ef3c4554a4ab9e581c88d8b4826eff955dde027239b4899304552d83d20dc897",
        "05e5b4cbe7aa75eaf80cca6a085a35f5f20be68e1d08b98b1dd32b2c108fc328"
      ]
    })
  },
  forgingEnable: {
    id: s`forgingEnable`,
    type: "object",
    properties: respProps(),
	example: successResp()
  },
  forgingDisable: {
    id: s`forgingDisable`,
    type: "object",
    properties: respProps(),
	example: successResp()
  },
  accessDenied: {
    id: s`accessDenied`,
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      error: "Delegates API Access Denied"
    }
  }
};
