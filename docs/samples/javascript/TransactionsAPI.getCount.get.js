import { rise } from 'risejs'

rise.transactions
  .count()
  .then(function({ confirmed }) {
    console.log(confirmed) // 563381
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
