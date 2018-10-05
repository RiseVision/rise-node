import { rise } from 'risejs'

rise.loader
  .status()
  .then(function({ loaded }) {
    console.log(loaded) // true
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
