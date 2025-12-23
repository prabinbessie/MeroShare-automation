const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json', 'utf8'));
p.bin = { "meroshare-asba": "./bootstrap.cjs" };
p.files = p.files || [];
if (!p.files.includes("bootstrap.cjs")) p.files.push("bootstrap.cjs");
fs.writeFileSync('package.json', JSON.stringify(p, null, 2));
console.log('package.json updated');
