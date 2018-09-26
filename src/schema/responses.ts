export default {
  account: {
    id: "responses.account",
    type: "object",
    properties: {
      success: {
        type: "boolean"
      },
      error: {
        type: "string"
      },
      account: {
        type: "object",
        properties: {
          address: { type: "string" },
          balance: { type: "number" },
          multisignatures: {
            type: "array",
            items: { type: "string", format: "binary" }
          },
          publicKey: { type: "string", format: "binary" },
          secondPublicKey: { type: "string", format: "binary" },
          secondSignature: { type: "boolean" },
          u_multisignatures: {
            type: "array",
            items: { type: "string", format: "binary" }
          },
          unconfirmedBalance: { type: "number" },
          unconfirmedSignature: { type: "boolean" }
        }
      }
    },
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
  }
};
