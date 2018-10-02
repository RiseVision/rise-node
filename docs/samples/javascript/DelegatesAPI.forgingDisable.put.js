import { rise } from 'risejs'

rise.delegates
  .toggleForging({ enable: false, secret: 'secret' })
  .then(function() {
    console.log('disabled')
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
