import { leaf } from '@carnesen/cli';

export const docker_start = leaf({
  commandName: 'start',
  description: 'Starts the container using config.json',

  async action() {
    // TODO check if in the correct dir
    // await execa('docker-compose build; docker-compose up', 'Blockchain ready');
    console.log('Docker started');
  },
});
