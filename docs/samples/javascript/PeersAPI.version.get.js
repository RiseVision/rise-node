import { rise } from 'risejs'

rise.peers
  .version()
  .then(function({ version }) {
    console.log(version) // 1.1.1
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
