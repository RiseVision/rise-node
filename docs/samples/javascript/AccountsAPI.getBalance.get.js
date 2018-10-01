import { rise } from 'risejs'

rise.accounts
  .getBalance('8093718274007724701R')
  .then(function({ balance }) {
    console.log(balance) // 2973803650603
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
