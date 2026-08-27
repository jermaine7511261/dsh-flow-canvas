
const core = require('./src/core/index.js')
// Make core available as global for the server
globalThis.__core = core
// Now run the server (it will use the global core)
require('./src/server/index.ts')
