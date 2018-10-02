import { rise } from 'risejs'

rise.delegates
  .getByPublicKey(
    '7067a911f3a4e13facbae9006b52a0c3ac9824bdd9f37168303152ae49dcb1c0'
  )
  .then(function({ delegate }) {
    console.log(delegate.username) // official_pool
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
