import { rise } from 'risejs'

rise.blocks
  .getReward()
  .then(function({ reward }) {
    console.log(reward) // 1200000000
  })
  .catch(function(err) {
    console.log('Error: ', err) // handle error
  })
