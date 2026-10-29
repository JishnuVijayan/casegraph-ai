import { compose, initialize } from './local.mjs';

try {
  const action = process.argv[2];
  switch (action) {
    case 'init':
      initialize();
      console.log('Private evidence directory and local configuration ready. Existing files preserved.');
      break;
    case 'config': compose(['config', '--quiet']); break;
    case 'up':
      initialize();
      compose(['config', '--quiet']);
      compose(['up', '-d', '--wait', '--wait-timeout', '90']);
      break;
    case 'down': compose(['down', '--timeout', '15']); break;
    case 'status': compose(['ps']); break;
    default: throw new Error('Use init, config, up, down or status.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
