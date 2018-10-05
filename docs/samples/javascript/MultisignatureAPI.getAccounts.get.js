import { rise } from 'risejs'

rise.multiSignatures
  .getAccounts(
    '05e5b4cbe7aa75eaf80cca6a085a35f5f20be68e1d08b98b1dd32b2c108fc328'
  )
  .then(function({ accounts }) {
    console.log(accounts[0].address) // 6507244540548668920R
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
