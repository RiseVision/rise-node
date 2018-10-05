import { rise } from 'risejs'

rise.transactions
  .getUnconfirmedTransactions()
  .then(function({ count }) {
    console.log(count) // 3
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
