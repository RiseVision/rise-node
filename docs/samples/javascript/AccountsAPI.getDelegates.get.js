import { rise } from 'risejs'

rise.accounts
  .getDelegates('8093718274007724701R')
  .then(function({ delegates }) {
    console.log(delegates[0].publicKey) // "5d3c3c5cdead6...
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
