import { rise } from 'risejs'

rise.blocks
  .getFeeSchedule()
  .then(function({ fees }) {
    console.log(fees.send) // 10000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
