import { rise } from 'risejs'

rise.transactions
  .getTransaction('6920969059388666996')
  .then(function({ transaction }) {
    console.log(transaction.type) // 0
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
