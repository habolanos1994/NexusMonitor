const { MongoClient } = require('mongodb');
const os = require('os');

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const util = require('util');
const writeFile = util.promisify(fs.writeFile);

const hostname = `${os.hostname()}`;
const connectionString = "mongodb://pcv1engmongo01:27017";
const client = new MongoClient(connectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsCertificateKeyFile: path.join(__dirname, '../certs/mongodb.pem'),
    tlsCAFile: path.join(__dirname, '../certs/IOTVLANServices_bundle.pem')
});

let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db("ELP"); // Replace <your_database_name> with the name of your database
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
    }
}

connectDB();

let seq = 0;
let currentDay = new Date().getDate();

async function saveToMongoDB(Area, Line,Station, message, bn) {
    const today = new Date().getDate();

    if (today !== currentDay) {
        seq = 0;
        currentDay = today;
    }
    seq++;

    const metadata = {
        Plant: "ELP",
        Area: Area,
        Line: Line,
        Station: Station,
        DeviceID: hostname,
        seq: seq,
    };

    const payload = {
        bn: bn,
        ts: new Date(),
        md: metadata,
        ...message,
    };

    try {
        const result = await db.collection('OEE').insertOne(payload);
        console.log(`Data saved with id: ${result.insertedId}`);
    } catch (error) {
        console.error("Error saving data to MongoDB", error);
    }
}

async function uploadTagConfigs() {

    const plcConfigsPath = path.join(__dirname, './jsonfiles/plc-configs.json');
    let plcConfigs;
    try {
        const plcConfigsData = await fsPromises.readFile(plcConfigsPath, 'utf8');
        plcConfigs = JSON.parse(plcConfigsData);
    } catch (error) {
        console.error("Error reading the PLC configs JSON file", error);
        return;
    }
  
    for (let plcConfig of plcConfigs) {
        const fileName = plcConfig.tagConfigsFile;
        const jsonPath = path.join(__dirname, fileName);
        let tagConfigs;
        try {
            const rawData = await fsPromises.readFile(jsonPath, 'utf8');
            tagConfigs = JSON.parse(rawData);
        } catch (error) {
            console.error("Error reading the JSON file", error);
            return;
        }
      
        let stations = {};
      
        for (let tagConfig of tagConfigs) {
            const stationName = tagConfig.StationName;
            if (!stations[stationName]) {
                stations[stationName] = {};
            }
            if (!stations[stationName][tagConfig.Index2]) {
                stations[stationName][tagConfig.Index2] = {};
            }
            stations[stationName][tagConfig.Index2][tagConfig.alias] = tagConfig.name;
        }
      
        for (let [stationName, tagSubgroups] of Object.entries(stations)) {
            let reportData = [];
      
            for (let [taggroup, tags] of Object.entries(tagSubgroups)) {
                reportData.push({
                    Index1: tagConfigs[0].Index1, // assuming that the Index1 is the same for all tagConfigs in a group
                    Index2: taggroup,
                    Type: "PieChart",
                    Title: taggroup,
                    Tags: tags
                });
            }
      
            const metadata = {
                Plant: plcConfig.Plant,
                Area: plcConfig.Area,
                Line: plcConfig.Line,
                StationName: stationName,
                ControllerType: plcConfig.ControllerType,
                plcIpAddress: plcConfig.plcIpAddress,
                plcname: plcConfig.plcName,
                emissionFrequency: plcConfig.emissionFrequency,
                ReportData: reportData
            };
      
            try {
                const result = await db.collection('Equipment').insertOne(metadata);
                console.log(`Data saved with id: ${result.insertedId}`);
            } catch (error) {
                console.error("Error saving data to MongoDB", error);
            }
        }
    }
  }
  
  async function getTagConfigs() {

    await clearJsonFiles();


    let cursor;

    // Query MongoDB
    try {
        cursor = await db.collection('Equipment').find();
    } catch (error) {
        console.error("Error reading data from MongoDB", error);
        return;
    }

    let results = await cursor.toArray();
    let plcConfigs = [];

    for (let result of results) {
        if (result) {
            let reportData = result.ReportData;

            // Check if a configuration for this PLC already exists
            let existingPlcConfig = plcConfigs.find(pc => pc.plcIpAddress === result.plcIpAddress);


            if (!existingPlcConfig) {
                // If not, create a new PLC configuration
                let plcConfig = {
                    plcName: result.plcname,
                    plcIpAddress: result.plcIpAddress,
                    tagConfigsFile: `./jsonfiles/${result.plcname}_tagconfig.json`,
                    Plant: result.Plant,
                    Area: result.Area,
                    Line: result.Line,
                    emissionFrequency: result.emissionFrequency,
                    ControllerType: result.ControllerType
                };
                plcConfigs.push(plcConfig);
            }

            let stationTagConfigs = {};
            for (let report of reportData) {
                const stationName = result.StationName;
                if (!stationTagConfigs[stationName]) {
                    stationTagConfigs[stationName] = {};
                }
                if (!stationTagConfigs[stationName][report.Index1]) {
                    stationTagConfigs[stationName][report.Index1] = {};
                }
                for (let [alias, name] of Object.entries(report.Tags)) {
                    if (!stationTagConfigs[stationName][report.Index1][report.Index2]) {
                        stationTagConfigs[stationName][report.Index1][report.Index2] = [];
                    }
                    stationTagConfigs[stationName][report.Index1][report.Index2].push({
                        name: name,
                        alias: alias,
                    });
                }
            }

            let filePath = `./jsonfiles/${result.plcname}_tagconfig.json`;

            // Collect all tagConfigs in an array
            let allTagConfigs = [];

            for (let [stationName, tagSubgroups] of Object.entries(stationTagConfigs)) {
                for (let [index1, taggroup] of Object.entries(tagSubgroups)) {
                    for (let [index2, tags] of Object.entries(taggroup)) {
                        for (let tag of tags) {
                            allTagConfigs.push({
                                name: tag.name,
                                alias: tag.alias,
                                Index2: index2,
                                StationName: stationName,
                                Index1: index1
                            });
                        }
                    }
                }
            }

            // If file exists, read it and combine data. If it doesn't, create it.
            try {
                let existingData = [];
                if (fs.existsSync(filePath)) {
                    existingData = JSON.parse(await fsPromises.readFile(filePath));
                }
                let combinedData = [...existingData, ...allTagConfigs];
                await fsPromises.writeFile(filePath, JSON.stringify(combinedData, null, 2));
                console.log(`Data saved to file: ${filePath}`);
            } catch (error) {
                console.error("Error working with the JSON file", error);
            }
        }
    }

    // Save PLC configs as JSON file
    try {
        await fsPromises.writeFile("./jsonfiles/plc-configs.json", JSON.stringify(plcConfigs, null, 2));
        console.log(`Data saved to plc-configs.json`);
    } catch (error) {
        console.error("Error writing the JSON file", error);
    }
    clearAnyFromJsonFiles()

}

async function clearJsonFiles() {
    // Path to the PLC configs JSON file
    const plcConfigsPath = path.join(__dirname, './jsonfiles/plc-configs.json');

    // Read PLC configs JSON file
    let plcConfigs;
    try {
        const plcConfigsData = await fsPromises.readFile(plcConfigsPath, 'utf8');  // Use utf8 encoding
        plcConfigs = JSON.parse(plcConfigsData);
    } catch (error) {
        console.error("Error reading the PLC configs JSON file", error);
        return;
    }

    // For each PLC config, clear the corresponding _tagconfig.json file
    for (let plcConfig of plcConfigs) {
        const fileName = plcConfig.tagConfigsFile;
        const filePath = path.join(__dirname, fileName);

        // Clear the content by writing an empty array to the file
        try {
            await fsPromises.writeFile(filePath, JSON.stringify([]), 'utf8');  // Use utf8 encoding
            console.log(`Data cleared from file: ${filePath}`);
        } catch (error) {
            console.error(`Error clearing the JSON file: ${filePath}`, error);
        }
    }
}

async function clearAnyFromJsonFiles() {
    // Path to the PLC configs JSON file
    const plcConfigsPath = path.join(__dirname, './jsonfiles/plc-configs.json');

    // Read PLC configs JSON file
    let plcConfigs;
    try {
        const plcConfigsData = await fsPromises.readFile(plcConfigsPath, 'utf8');  // Use utf8 encoding
        plcConfigs = JSON.parse(plcConfigsData);
    } catch (error) {
        console.error("Error reading the PLC configs JSON file", error);
        return;
    }

    // For each PLC config, remove 'any' from the corresponding _tagconfig.json file
    for (let plcConfig of plcConfigs) {
        const fileName = plcConfig.tagConfigsFile;
        const filePath = path.join(__dirname, fileName);

        let tagConfig;
        try {
            const tagConfigData = await fsPromises.readFile(filePath, 'utf8');  // Use utf8 encoding
            tagConfig = JSON.parse(tagConfigData);
        } catch (error) {
            console.error(`Error reading the tag config JSON file: ${filePath}`, error);
            continue;
        }

        // Filter out keys with 'any' name or value (case-insensitive)
        let removedData = false;
        tagConfig = tagConfig.map(tag => {
            for (let key in tag) {
                if (key.toLowerCase() === 'any' || String(tag[key]).toLowerCase() === 'any') {
                    delete tag[key];
                    removedData = true;
                }
            }
            return tag;
        });

        // Write the filtered data back to the file
        try {
            await fsPromises.writeFile(filePath, JSON.stringify(tagConfig), 'utf8');  // Use utf8 encoding
            console.log(`Data checked in file: ${filePath}`);
        } catch (error) {
            console.error(`Error writing to the JSON file: ${filePath}`, error);
        }

        // Log if no data removed
        if (!removedData) {
            console.log(`No 'any' data found in file: ${filePath}`);
        }
    }
}


module.exports = { saveToMongoDB,  uploadTagConfigs, connectDB , getTagConfigs};

