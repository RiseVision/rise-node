import { rise } from 'risejs'

rise.delegates
  .toggleForging({ enable: true, secret: 'secret' })
  .then(function() {
    console.log('enabled')
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
