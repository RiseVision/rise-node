import { rise } from 'risejs'

rise.delegates
  .search({ q: 'pool' })
  .then(function({ delegates }) {
    console.log(delegates[0].username) // official_pool
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
