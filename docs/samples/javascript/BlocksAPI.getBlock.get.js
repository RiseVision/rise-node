import { rise } from 'risejs'

rise.blocks
  .getBlock('1359353064084280533')
  .then(function({ block }) {
    console.log(block.id) // 1359353064084280533
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
