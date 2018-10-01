import scalars from "./scalars";

const { username, address, balance, signature, publicKey } = scalars;

const respProps = (props = {}) =>
  Object.assign(
    {
      success: { type: "boolean" },
      error: { type: "string" }
    },
    props
  );

export default {
  account: {
    id: "responses.account",
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
          secondSignature: { type: "boolean" },
          u_multisignatures: {
            type: "array",
            items: signature
          },
          unconfirmedBalance: balance,
          unconfirmedSignature: { type: "boolean" }
        }
      }
    }),
    example: {
      success: true,
      account: {
        address: "0xabc1234...",
        balance: 20,
        multisignatures: [],
        publicKey: "0xdef789...",
        unconfirmedBalance: 21,
        unconfirmedSignature: false,
        secondSignature: false,
        u_multisignatures: []
      }
    }
  },
  balance: {
    id: "responses.balance",
    type: "object",
    properties: respProps({
      balance,
      unconfirmedBalance: balance
    }),
    example: {
      balance: 10,
      unconfirmedBalance: 20
    }
  },
  publicKey: {
    id: "responses.publicKey",
    type: "object",
    properties: respProps({
      publicKey
    }),
    example: {
      publicKey: "0x1242acdf..."
    }
  },
  delegates: {
    id: "responses.delegates",
    type: "object",
    properties: respProps({
      publicKey,
      delegates: {
        type: "array",
        items: {
          address,
          publicKey,
          username,
          approval: { type: "number" },
          rank: { type: "number" },
          rate: { type: "number" },
          missedblocks: { type: "number" },
          producedblocks: { type: "number" },
          productivity: { type: "number" },
          vote: { type: "number" }
        }
      }
    })
  },
  fee: {
    id: "responses.fee",
    type: "object",
    proprties: respProps({
      fee: { type: "number" }
    })
  },
  topAccounts: {
    id: "respones.topAccounts",
    type: "object",
    properties: respProps({
      accounts: {
        address,
        balance,
        publicKey
      }
    })
  },
  deprecated: {
    id: "responses.deprecated",
    type: "object",
    properties: respProps(),
    example: {
      success: false,
      message: "Method is deprecated"
    }
  }
};
