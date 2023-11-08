const fs = require("fs");
const path = require("path");

let modelcode = path.join(__dirname, "counterconf.json");
let modelscode = JSON.parse(fs.readFileSync(modelcode));

function findmodel(serial) {
    const serialcode = serial.slice(3, 5);
    //console.log(serialcode)
    const matchingModels = modelscode.models.filter((model) => model.code === serialcode);
    
    if (matchingModels.length > 0) {
      return matchingModels[0].model;
    } else {
      return "undefined";
    }
  }
  

module.exports = { findmodel };