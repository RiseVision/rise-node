import { rise } from 'risejs'

rise.blocks
  .getBlocks({ limit: 3 })
  .then(function({ blocks }) {
    console.log(blocks[0].id) // 1359353064084280533
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
