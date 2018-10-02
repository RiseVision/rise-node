import { rise } from 'risejs'

rise.blocks
  .getStatus()
  .then(function({ height }) {
    console.log(height) // 1356378
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
