import { respProps, successResp } from '../utils/responses'
import {
  username,
  address,
  balance,
  signature,
  publicKey,
  boolInt
} from "../common/scalars";
import { Delegate } from '../common/models'

export default {
  getAccount: {
    id: "responses.accounts.getAccount",
    type: "object",
    properties: respProps({
      account: {
        type: "object",
        properties: {
          address,
          balance,
          multisignatures: {
            type: "array",
            items: signature
          },
          publicKey,
          secondPublicKey: publicKey,
          secondSignature: boolInt,
          u_multisignatures: {
            type: "array",
            items: signature
          },
          unconfirmedBalance: balance,
          unconfirmedSignature: boolInt
        }
      }
    }),
    example: successResp({
      account: {
        address: "8093718274007724701R",
        balance: "2973803650603",
        multisignatures: [],
        publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0",
        secondPublicKey: "e26988a52c519c9766d6f32ec32202b1ab16e77f6e404134222552fb3df23565",
        unconfirmedBalance: "2973803650603",
        unconfirmedSignature: 1,
        secondSignature: 1,
        u_multisignatures: []
      }
    })
  },
  getBalance: {
    id: "responses.accounts.getBalance",
    type: "object",
    properties: respProps({
      balance,
      unconfirmedBalance: balance
    }),
    example: successResp({
      balance: "2973803650603",
      unconfirmedBalance: "2973803650603"
    })
  },
  getPublickey: {
    id: "responses.accounts.getPublickey",
    type: "object",
    properties: respProps({
      publicKey
    }),
    example: successResp({
      publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0"
    })
  },
  delegates: {
    id: "responses.accounts.getDelegates",
    type: "object",
    properties: respProps({
      publicKey,
      delegates: {
        type: "array",
        items: Delegate
      }
    }),
    example: successResp({
      delegates: [
        {
          username: "therisepool",
          address: "14056190751918729107R",
          publicKey: "5d3c3c5cdead64d9fe7bc1bf1404ae1378912d77b0243143edf8aff5dda1dbde",
          vote: 97064376561139,
          producedblocks: 11939,
          missedblocks: 409,
          rate: 19,
          rank: 19,
          approval: 0.75,
          productivity: 96.69
        }
      ]
    })
  },
  getDelegatesFee: {
    id: "responses.accounts.getDelegatesFee",
    type: "object",
    proprties: respProps({
      fee: { type: "number" }
    }),
    example: successResp({
      fee: 2500000000
    })
  },
  top: {
    id: "responses.accounts.top",
    type: "object",
    properties: respProps({
      accounts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            address,
            balance,
            publicKey
          }
        }
      }
    }),
    example: successResp({
      accounts: [
        {
          address: "3262489507414775391R",
          balance: "1991694.49514931",
          publicKey: "e433144892f40c838d0ea865dde0915e4fdaecf3521efef585ff306e6513c8fc"
        },
        {
          address: "8093718274007724701R",
          balance: "29762.04739711",
          publicKey: "7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0"
        }
      ]
    })
  }
};
