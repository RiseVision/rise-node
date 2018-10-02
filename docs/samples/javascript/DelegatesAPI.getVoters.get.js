import { rise } from 'risejs'

rise.delegates
  .getVoters('a65a8160b1e0733f66d1f1a8f322c9af29b26d5e491a84d6e3ae0ec43e000446')
  .then(function({ accounts }) {
    console.log(accounts.length) // 5
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
