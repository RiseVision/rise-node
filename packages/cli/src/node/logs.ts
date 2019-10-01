// tslint:disable:no-console
import { branch } from '@carnesen/cli';
import archive from './logs/archive';
import path from './logs/path';
import show from './logs/show';

export default branch({
  commandName: 'logs',
  description: 'Show and manage logs',
  subcommands: [show, path, archive],
});
