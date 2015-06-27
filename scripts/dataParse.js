var fs = require('fs');
var csv = require('fast-csv');
var stream = fs.createReadStream("../data/clues.unx");

var csvStream = csv()
  .on("data", function(data){
       console.log(data);
  })
  .on("end", function(){
       console.log("done");
  });

var queue = [];
var i = 0;

csv
 .fromStream(stream, {headers : ["clue", "answer", "a", "b"], delimiter:'\t'})
 .on("data", function(data){
     queue.push(data);
     if (queue.length==500) {
       i++;
       fs.writeFileSync('../data/'+i+'.json',JSON.stringify(queue));
       queue = [];
     }
 })
 .on("end", function(){
     console.log(i);
 });
