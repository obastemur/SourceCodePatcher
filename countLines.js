var fs = require('fs');
var path = require('path');

var data = fs.readFileSync(process.argv[2]) + "";

var reg = /Line [1-9]+[:]+/g;

var arr = data.match(reg);

var Counts = {};
for(var i=0; i<arr.length;i++) {
  var number = parseInt(arr[i].replace("Line ", "").replace(":", ""))
  if (Counts.hasOwnProperty(number + "")) {
    Counts[number + ""]++;
  } else {
    Counts[number + ""] = 1;
  }
}

for(var o in Counts) {
  if (!Counts.hasOwnProperty(o)) continue;
  if (Counts[o] < 3) continue;
  console.log(o, "->", Counts[o])
}
