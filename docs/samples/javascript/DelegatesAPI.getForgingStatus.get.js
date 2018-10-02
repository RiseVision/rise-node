import { rise } from 'risejs'

rise.delegates
  .getForgingStatus()
  .then(function({ enabled }) {
    console.log(enabled) // true
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
