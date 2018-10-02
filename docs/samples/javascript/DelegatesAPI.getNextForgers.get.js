import { rise } from 'risejs'

rise.delegates
  .getNextForgers()
  .then(function({ delegates }) {
    console.log(delegates[0]) // a65a8160b1e07...
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
