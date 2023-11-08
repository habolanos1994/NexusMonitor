const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const path = require("path");
const schedule = require('node-schedule');
const encoder = new TextDecoder();
const { saveToMongoDB } = require("../mongo")
const { sendsmtp } = require("../smtp");

const config = {
  plcIpAddress: "10.63.192.32",
  maxReconnectDelay: 120000, // 120 seconds
  reconnectAttempts: 0,
};

let PLC = new Controller({ timeout: 5000 });
let tagConfigs = loadTagConfigs(path.join(__dirname, "tagConfigs2.json"));
let tags = tagConfigs.map((config) => PLC.newTag(config.name));
let values = {};
let totalUnits = {};
let ErrorSet = new Set();
let reconnectJob;

let groupCounters = {};

function loadTagConfigs(tagConfigsFile) {
  try {
    return JSON.parse(fs.readFileSync(tagConfigsFile));
  } catch (err) {
    console.error("Error reading tag config:", err);
    return [];
  }
}

setInterval(() => {
  totalUnits = getTotalUnits();
}, 10000);

function getTotalUnits() {
  try {
    const totalUnits = JSON.parse(fs.readFileSync("TotalUnits.json"));
    return { ...totalUnits };
  } catch (err) {
    console.error("Error reading TotalUnits.json:", err);
    return null;
  }
}

function reconnectAfterDelay() {
  let delay = Math.min(60000 * (config.reconnectAttempts + 1), config.maxReconnectDelay);
  console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
  setTimeout(() => {
    config.reconnectAttempts++;
    if (config.reconnectAttempts > 10) {
      process.exit(1);
    }
    connectToPLC();
  }, delay);
}

PLC.on('Disconnected', () => {
  sendsmtp(`MongoDB service plc Report Plc disconnected`)
  console.log('Disconnected from PLC.');
  config.reconnectAttempts++;
  reconnectAfterDelay();
});

PLC.on('Error', (err) => {
  sendsmtp(`MongoDB service plc Report Plc Error: ${err}`)
  console.log('Error encountered:', err);
  config.reconnectAttempts++;
  reconnectAfterDelay();
});

async function readTagsAndUpdateValues() {
  let values = {};
  const tagGroupUniqueAliases = {};

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const config = tagConfigs[i];
    const publishGroup = config.PublishGroup;
    const tagConvertion = config.tagConvertion;
    var tagvalue;

    if (!values[publishGroup]) {
      values[publishGroup] = {};
    }

    if (!groupCounters[publishGroup]) {
      groupCounters[publishGroup] = 1;
    }

    try {
      // Read tag
      await PLC.readTag(tag);

      if (tagConvertion == 'Buffer') {
        const arr = new Uint8Array(tag.value);
        const slicedArr = arr.slice(1); // Slice the array starting from the second byte
        const filteredArr = slicedArr.filter(byte => byte !== 0); // Remove all null bytes (0x00)
        const srt = encoder.decode(filteredArr);
        tagvalue = srt;
      } else {
        tagvalue = tag.value;
      }

      // Store values
      const tagGroupName = config.taggroup;
      if (tagGroupName !== "") {
        if (!values[publishGroup].hasOwnProperty(tagGroupName)) {
          values[publishGroup][tagGroupName] = {};
        }

        if (!tagGroupUniqueAliases.hasOwnProperty(publishGroup)) {
          tagGroupUniqueAliases[publishGroup] = {};
        }
        if (!tagGroupUniqueAliases[publishGroup].hasOwnProperty(tagGroupName)) {
          tagGroupUniqueAliases[publishGroup][tagGroupName] = new Set();
        }

        let aliasKey = config.alias;
        if (tagGroupUniqueAliases[publishGroup][tagGroupName].has(aliasKey)) {
          aliasKey += groupCounters[publishGroup];
        }

        values[publishGroup][tagGroupName][aliasKey] = tagvalue;
        tagGroupUniqueAliases[publishGroup][tagGroupName].add(config.alias);
        groupCounters[publishGroup]++;
      } else {
        values[publishGroup][config.alias] = tagvalue;
      }
    } catch (error) {
      ErrorSet.add(`Error reading tag '${config.name}': ${error.message}`)
      console.error(`Error reading tag '${config.name}': ${error.message}`);
    }
  }

  if (Object.keys(values).length === 0) {
    console.log('No tags were read. Attempting to reconnect...');
    ErrorSet.add('No tags were read. Attempting to reconnect...')
    setTimeout(readTagsAndUpdateValues, 1000);
  } else {


    Object.keys(values).forEach((key) => {
      if (key == 'Mark012') {
        const totalUnits = getTotalUnits();
        //const productionCounters = addProductionCounters();
        const data = {
          OEE_Data: values[key],
          Production: {
            ...totalUnits,
          },
  
        };
        //console.log(data)
        saveToMongoDB(`${key}`, data)
      } else {
        const data = {
          OEE_Data: values[key],
        };
        //console.log(`${key}:`, values[key]);
        saveToMongoDB(`${key}`, data)
      }
  
    });

  }

  if (ErrorSet.size > 0) {
    sendsmtp(ErrorSet.join(', '))
    console.error(ErrorSet)
    config.reconnectAttempts++;
    reconnectAfterDelay();
  } else {
    config.reconnectAttempts = 0;
  }

  values = {};

 
}

async function connectToPLC() {
  PLC.connect(config.plcIpAddress, 0)
    .then(async () => {
      console.log("Connected to PLC");
      sendsmtp(`MongoDB service plc Report: Connected to PLC`) // Send email on successful connection

      await readTagsAndUpdateValues(); 
      config.reconnectAttempts = 0;
      if (reconnectJob) {
        reconnectJob.cancel();
      }
      reconnectJob = schedule.scheduleJob("0,15,30 * * * *", readTagsAndUpdateValues);

    })
    .catch(error => {
      sendsmtp(`Mongo service plc Report Plc Error: ${error}`)
      console.error(`Failed to connect to PLC: ${error}`);
      reconnectAfterDelay();
    });
}

process.on('uncaughtException', (err) => {
  console.log('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

connectToPLC();


