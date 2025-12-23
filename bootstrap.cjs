#!/usr/bin/env node
(async () => {
  try {
    await import('./src/index.js');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
