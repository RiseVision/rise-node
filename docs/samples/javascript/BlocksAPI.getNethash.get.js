import { rise } from 'risejs'

rise.blocks
  .getNethash()
  .then(function({ nethash }) {
    console.log(nethash) // cd8171332c...
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
