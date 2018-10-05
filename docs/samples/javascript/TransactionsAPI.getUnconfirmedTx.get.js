import { rise } from 'risejs'

rise.transactions
  .getUnconfirmedTransaction('6920969059388666996')
  .then(function({ transaction }) {
    console.log(transaction.fee) // 10000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
