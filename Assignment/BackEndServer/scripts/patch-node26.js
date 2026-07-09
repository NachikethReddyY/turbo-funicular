const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'buffer-equal-constant-time', 'index.js');
if (!fs.existsSync(file)) process.exit(0);

let source = fs.readFileSync(file, 'utf8');
const before = "var SlowBuffer = require('buffer').SlowBuffer;";
const after = "var SlowBuffer = require('buffer').SlowBuffer || Buffer;";

if (source.includes(before)) {
  source = source.replace(before, after);
  fs.writeFileSync(file, source);
  console.log('Patched buffer-equal-constant-time for Node 26.');
}
