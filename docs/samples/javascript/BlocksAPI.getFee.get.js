import { rise } from 'risejs'

rise.blocks
  .getFee()
  .then(function({ fee }) {
    console.log(fee) // 10000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
