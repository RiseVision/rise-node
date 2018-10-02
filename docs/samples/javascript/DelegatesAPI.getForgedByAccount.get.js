import { rise } from 'risejs'

rise.delegates
  .getForgedByAccount(
    '7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0'
  )
  .then(function({ forged }) {
    console.log(forged) // 19066025346961
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
