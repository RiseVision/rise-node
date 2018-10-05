import { rise } from 'risejs'

rise.transactions
  .put({
    type: 0,
    senderPublicKey: "bf4809a1a08c9dffbba741f0c7b9f49145602341d5fa306fb3cd592d3e1058b3",
    senderId: "1644223775232371040R",
    recipientId: "3303015780877366956R",
    amount: 199533766861,
    fee: 10000000
    ...
  })
  .then(function({ accepted }) {
    console.log(accepted.length) // 1
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
