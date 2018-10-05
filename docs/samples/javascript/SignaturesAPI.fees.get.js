import { rise } from 'risejs'

rise.signatures
  .getSecondSignatureFee()
  .then(function({ fee }) {
    console.log(fee) // 500000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
