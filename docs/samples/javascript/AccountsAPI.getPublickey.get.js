import { rise } from 'risejs'

rise.accounts
  .getPublicKey('8093718274007724701R')
  .then(function({ publicKey }) {
    console.log(publicKey) // "7067a911f3a4...
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
