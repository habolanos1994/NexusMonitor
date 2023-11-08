const fs = require("fs");
const path = require("path");
const readline = require('readline');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

let modelcode = path.join(__dirname, "counterconf.json");
let modelscode = JSON.parse(fs.readFileSync(modelcode));
const csvFile = path.join(__dirname, 'serials.csv');

function findmodel(serial) {
    const serialcode = serial.slice(3, 5);
    const matchingModels = modelscode.models.filter((model) => model.code === serialcode);

    if (matchingModels.length > 0) {
        return matchingModels[0].model;
    } else {
        return "undefined";
    }
}

let modelCounts = {};
let undefinedSerials = [];

const csvWriter = createCsvWriter({
    path: 'undefinedSerials.csv',
    header: [
        {id: 'serial', title: 'SERIAL'}
    ]
});

const readInterface = readline.createInterface({
    input: fs.createReadStream(csvFile),
    output: process.stdout,
    console: true
});

readInterface.on('line', (line) => {
    let model = findmodel(line);

    if (model == 'Hopper Plus' ) {
        console.log(`HOPPER plus Serial ${line}`)
    }

    modelCounts[model] = (modelCounts[model] || 0) + 1;

    if (model === 'undefined') {
        undefinedSerials.push({serial: line});
    }
});

readInterface.on('close', () => {
    console.log('CSV file successfully processed');
    fs.writeFile('modelCounts.json', JSON.stringify(modelCounts, null, 2), (err) => {
        if (err) {
            console.error('Failed to write file:', err);
        } else {
            console.log('Wrote count to modelCounts.json');
        }
    });

    csvWriter
        .writeRecords(undefinedSerials)
        .then(() => console.log('Undefined serial numbers written to undefinedSerials.csv'));
});
