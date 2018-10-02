import { rise } from 'risejs'

rise.blocks
  .getSupply()
  .then(function({ supply }) {
    console.log(supply) // 12943860841000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
