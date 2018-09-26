import { rise } from 'risejs'

rise.accounts
  .getAccount({ address: '0xabc1213...' })
  .then(function(res) {
    console.log(res.balance) // 20
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
