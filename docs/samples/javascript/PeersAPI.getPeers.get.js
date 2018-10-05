import { rise } from 'risejs'

rise.peers
  .getList()
  .then(function({ peers }) {
    console.log(peers.length) // 5
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
