import { rise } from 'risejs'

rise.transactions
  .getList()
  .then(function({ count }) {
    console.log(count) // 563381
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
