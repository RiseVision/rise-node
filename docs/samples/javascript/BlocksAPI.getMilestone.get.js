import { rise } from 'risejs'

rise.blocks
  .getMilestone()
  .then(function({ milestone }) {
    console.log(milestone) // 5
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
