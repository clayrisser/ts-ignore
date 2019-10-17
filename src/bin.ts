import { handle } from '@oclif/errors';
import TSIgnore from './index';

(async () => {
  try {
    await TSIgnore.run();
  } catch (err) {
    handle(err);
  }
})();
