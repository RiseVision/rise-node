import { respProps, successResp } from "../utils/responses";
import { wholeNum, height, amount, hex, datetime } from "../common/scalars";
import { Block } from "../common/models";

export default {
  getBlock: {
    id: "responses.blocks.getBlock",
    type: "object",
    properties: respProps({
      block: Block
    }),
    example: successResp({
      block: {
        id: "1359353064084280533",
        rowId: 1356343,
        version: 0,
        timestamp: 74366340,
        height: 1355968,
        previousBlock: "16932703546606415596",
        numberOfTransactions: 1,
        totalAmount: 155090000000,
        totalFee: 10000000,
        reward: 1200000000,
        payloadLength: 117,
        payloadHash: "8f20883b18d72a47ee3a6dafdbc6d3e398b5e51f7f2d717c33975fd4ad945a34",
        generatorPublicKey: "c3bf0d2e95d2eb2479ee338915d72430a114c509c453ef21d8a07d6b9a564c19",
        blockSignature: "8d05f09d9a25a03d6234e36b20ba08467618eab4b2df9c3453606964ba7a030c22044f2fa6018892230a1cc8a04e5d73f122fc770d0629884e5ba6de00a05507",
        transactions: [
          {
            signatures: [],
            id: "5128147624792694927",
            rowId: 560070,
            height: 1355968,
            blockId: "1359353064084280533",
            type: 0,
            timestamp: 74366321,
            senderPublicKey: "7605b8b4baa61efbf493a5e2c783e701226a2200c45bc28ebea8f52ab4ce3188",
            senderId: "1887676714119818627R",
            recipientId: "5920507067941756798R",
            amount: 155090000000,
            fee: 10000000,
            signature: "d8c4c0ac3c45781922865dcec37362d2785bbc89bb8e6d0b219e6755c7d72f78beea0fccb6b15442772623d973c722f6cd64d9ad63e896f36688e9bb13f87505",
            signSignature: null,
            requesterPublicKey: null,
            asset: null,
            confirmations: 29
          }
        ]
      }
    })
  },
  getBlocks: {
    id: "responses.blocks.getBlocks",
    type: "object",
    properties: respProps({
      blocks: {
        type: "array",
        items: Block
      },
      count: wholeNum
    }),
    example: successResp({
      count: 1356390,
      blocks: [
        {
          id: "1359353064084280533",
          rowId: 1356766,
          version: 0,
          timestamp: 74366340,
          height: 1356391,
          previousBlock: "6501365850122980670",
          numberOfTransactions: 1,
          totalAmount: 155090000000,
          totalFee: 10000000,
          reward: 1200000000,
          payloadLength: 117,
          payloadHash: "8f20883b18d72a47ee3a6dafdbc6d3e398b5e51f7f2d717c33975fd4ad945a34",
          generatorPublicKey: "c3bf0d2e95d2eb2479ee338915d72430a114c509c453ef21d8a07d6b9a564c19",
          blockSignature: "8d05f09d9a25a03d6234e36b20ba08467618eab4b2df9c3453606964ba7a030c22044f2fa6018892230a1cc8a04e5d73f122fc770d0629884e5ba6de00a05507",
          transactions: [
            {
              signatures: [],
              id: "5128147624792694927",
              rowId: 560070,
              height: 1355968,
              blockId: "1359353064084280533",
              type: 0,
              timestamp: 74366321,
              senderPublicKey: "7605b8b4baa61efbf493a5e2c783e701226a2200c45bc28ebea8f52ab4ce3188",
              senderId: "1887676714119818627R",
              recipientId: "5920507067941756798R",
              amount: 155090000000,
              fee: 10000000,
              signature: "d8c4c0ac3c45781922865dcec37362d2785bbc89bb8e6d0b219e6755c7d72f78beea0fccb6b15442772623d973c722f6cd64d9ad63e896f36688e9bb13f87505",
              signSignature: null,
              requesterPublicKey: null,
              asset: null,
              confirmations: 29
            }
          ]
        },
        {
          id: "6501365850122980670",
          rowId: 1356765,
          version: 0,
          timestamp: 74379510,
          height: 1356390,
          previousBlock: "14921645259042587857",
          numberOfTransactions: 0,
          totalAmount: 0,
          totalFee: 0,
          reward: 1200000000,
          payloadLength: 0,
          payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          generatorPublicKey: "16d725d3430beb17638397f48c66f035ed25ddcc02220ab3d311b6a0a3d8f349",
          blockSignature: "7197567651282ae370066d953d3aa1a5ef99965ca504115ca690e651888d1bb19e10fab0ae95982013143e9c636114a86be7abbdae255e188113d13393ef460a",
          transactions: []
        },
        {
          id: "14921645259042587857",
          rowId: 1356764,
          version: 0,
          timestamp: 74379480,
          height: 1356389,
          previousBlock: "11101205285804076839",
          numberOfTransactions: 0,
          totalAmount: 0,
          totalFee: 0,
          reward: 1200000000,
          payloadLength: 0,
          payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          generatorPublicKey: "696a15b1e89a1e9b22858500d982095f4bfbf315b337f6181a6f278602340577",
          blockSignature: "466ab9de1d95469d2da02ed4fcbc15d2560f512b82b478b7d29e2a00b65dbac5b6df6cab7f02c65affa3d933a1c95e0f7c3f43d9999b5682b355ed57fac7fa09",
          transactions: []
        }
      ]
    })
  },
  getHeight: {
    id: "responses.blocks.getHeight",
    type: "object",
    properties: respProps({
      height
    }),
    example: successResp({
      height: 1356378
    })
  },
  getFee: {
    id: "responses.blocks.getFee",
    type: "object",
    properties: respProps({
      fee: amount,
      fromHeight: height,
      toHeight: height,
      height
    }),
    example: successResp({
      fee: 10000000,
      fromHeight: 1,
      toHeight: null,
      height: 1356378
    })
  },
  getFees: {
    id: "responses.blocks.getFees",
    type: "object",
    properties: respProps({
      fees: {
        type: "object",
        properties: {
          send: amount,
          vote: amount,
          secondSignature: amount,
          delegate: amount,
          multisignature: amount
        }
      },
      fromHeight: height,
      toHeight: height,
      height
    }),
    example: successResp({
      fees: {
        send: 10000000,
        vote: 100000000,
        secondsignature: 500000000,
        delegate: 2500000000,
        multisignature: 500000000
      },
      fromHeight: 1,
      toHeight: null,
      height: 1356378
    })
  },
  getNethash: {
    id: "responses.blocks.getNethash",
    type: "object",
    properties: respProps({
      nethash: hex
    }),
    example: successResp({
      nethash: "cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5"
    })
  },
  getMilestone: {
    id: "responses.blocks.getMilestone",
    type: "object",
    properties: respProps({
      milestone: wholeNum
    }),
    example: successResp({
      milestone: 5
    })
  },
  getReward: {
    id: "responses.blocks.getReward",
    type: "object",
    properties: respProps({
      reward: amount
    }),
    example: successResp({
      reward: 1200000000
    })
  },
  getEpoch: {
    id: "responses.blocks.getEpoch",
    type: "object",
    properties: respProps({
      epoch: datetime
    }),
    example: successResp({
      epoch: "2016-05-24T17:00:00.000Z"
    })
  },
  getSupply: {
    id: "responses.blocks.getSupply",
    type: "object",
    properties: respProps({
      supply: amount
    }),
    example: successResp({
      supply: 12943860841000000
    })
  },
  getBroadHash: {
    id: "responses.blocks.getBroadHash",
    type: "object",
    properties: respProps({
      broadhash: hex
    }),
    example: successResp({
      broadhash: "ab424cb2d4bbf0a4d97cd055039d7d451ef6512e46ea950dd712645149f209dc"
    })
  },
  getStatus: {
    id: "responses.blocks.getStatus",
    type: "object",
    properties: respProps({
      broadhash: hex,
      epoch: datetime,
      fee: amount,
      height,
      milestone: wholeNum,
      nethash: hex,
      reward: amount,
      supply: amount
    }),
    example: successResp({
      broadhash: "ab424cb2d4bbf0a4d97cd055039d7d451ef6512e46ea950dd712645149f209dc",
      epoch: "2016-05-24T17:00:00.000Z",
      fee: 10000000,
      height: 1356378,
      milestone: 5,
      nethash: "cd8171332c012514864edd8eb6f68fc3ea6cb2afbaf21c56e12751022684cea5",
      reward: 1200000000,
      supply: 12943860841000000
    })
  }
};
