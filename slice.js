var fs = require('fs')

var f = fs.readFileSync('../out.txt').slice(0, 1e7);
fs.writeFileSync('../out.txt', f);

f = fs.readFileSync('../out2.txt').slice(0, 1e7);
fs.writeFileSync('../out2.txt', f);
