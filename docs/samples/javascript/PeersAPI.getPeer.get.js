import { rise } from 'risejs'

rise.peers
  .getByIPPort({ ip: '45.32.178.6', port: 5555 })
  .then(function({ peer }) {
    console.log(peer.version) // 1.0.3
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
