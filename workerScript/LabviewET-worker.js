


// -----------------------------
// 1. Imports
// -----------------------------
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const sqlfunctions = require('../funtions/sql')
const schedule = require('node-schedule');
const { saveToMongoDB } = require("../funtions/mongo")
const { parentPort, workerData } = require('worker_threads');


// -----------------------------
// 2. Work startup
// -----------------------------



const {
  ServiceName,
  WorkerScript,
  AreaID,
  SubscriptionTopic,
  MQTTDDATATopic,
  Serialized,
} = workerData;

// const AreaID = '42'
// const SubscriptionTopic = ["ELP/HOPPER PLUS USB C/+/DDATA"]
// const ServiceName = 'WIRELESS ACCESS POINT_COSMETIC'
// const Serialized = false
// const topicpub = `ELP/EfficiencyTracker/${ServiceName}/DDATA`
// const bn = `ELP_EfficiencyTracker_${ServiceName}_DDATA`



// -----------------------------
// 3. Constants & Configurations
// -----------------------------
const hostname = os.hostname();
const sourcefile = path.basename(__filename);

const PASS = 'PASS';

const countdata = {
  serial: '',
  model: '',
  Result: '',
  Employee: '',
  Station: '',
  Unique: false
};


const mqttOptions = {
  host: 'pcv1engmqtt01',
  port: 1883,
  protocol: 'mqtt',
  rejectUnauthorized: false,
  clientId: `client${hostname}PLC${uuidv4()}`,
};


async function logs(type, message, event) {
  parentPort.postMessage({
    type: type,
    message: message,
    source: sourcefile,
    ServiceName : ServiceName,
    event: event
});
}


// -----------------------------
// 3. Global Variables
// -----------------------------
let client = mqtt.connect(mqttOptions);
let isConnected = false;
let connectionInterval = null;
let messageQueue = [];
let seq = 0;

let uniqueSerialsset = new Set();


var counters = {
  Yield: {},
  Stations: {},
  Models: {},
  Employees: {},
  HourlyProduction: {}
};

const bn = MQTTDDATATopic.replace(/\//g, '_');

// -----------------------------
// 4. Function Definitions
// -----------------------------



function subscribeToTopics(topics) {
  topics.forEach(topic => {
    client.subscribe(topic, { qos: 2 }, (err, granted) => {
      if (err) {
        console.error(`Error subscribing to topic ${topic}: ${err}`);
      } else {
        console.log(`Subscribed to topic ${topic} with QoS ${granted[0].qos}`);
      }
    });
  });
}


function onConnect() {
  isConnected = true;
  console.log('Connected to MQTT');
  clearInterval(connectionInterval);
  subscribeToTopics(SubscriptionTopic);
  processMessageQueue();
}

async function processMessageQueue() {
  while (messageQueue.length > 0) {
      const { topic, message } = messageQueue.shift();
      await processMessage(topic, message);
  }

  setTimeout(processMessageQueue, 100);  // Adjust the delay as needed
}

function onMessage(topic, message) {
  //console.log(`${topic}:${message}`)
  processMessage(topic, message);
}

function onClose() {
  isConnected = false;
  console.log('MQTT connection closed.');
  logs('restart',`Service Name: ${ServiceName} MQTT Close`,'Fail')
}


function mqttpub( messagepub){

  var payloadpub = {
    bn: bn,
    Host: hostname,
    mid: uuidv4(),
    ts: new Date(),
    seq: seq++,
    ...messagepub
  };
  //console.log(payload)
  client.publish(MQTTDDATATopic, JSON.stringify(payloadpub), { qos: 1, retain: true });
  seq = (seq + 1) % 10000;
}

async function processMessage(topic, message) {
  try {
    const msg = JSON.parse(message.toString());

    if (msg && msg.Data && msg.Data.ReceiverData && msg.md && msg.md.employee_info && msg.md.Station_info) {
      const {
        Data: { ReceiverData: { SerialNumber, FullNameModel }, ReceiverResultData: { TestResult } },
        md: { employee_info: { EmployeeName }, Station_info: { Station } }
      } = msg;

    countdata.serial = SerialNumber;
    countdata.model = FullNameModel;
    countdata.Employee = EmployeeName;
    countdata.Station = Station;
    countdata.Result = TestResult;

    countdata.Unique = Serialized ? !uniqueSerialsset.has(countdata.serial) : true;



    if (countdata.Unique) {
      updateCounter(counters.Yield, countdata.Result);

      if (countdata.Result.toUpperCase().includes('PASS') || countdata.Result.toUpperCase().includes('QRA')) {
        updateCounter(counters.Employees, countdata.Employee);
        updateCounter(counters.Models, countdata.model);
        updateCounter(counters.Stations, countdata.Station);
        updateCurrentHourCounter(counters.HourlyProduction);
      }
      

      if (Serialized && countdata.Unique) {
        uniqueSerialsset.add(countdata.serial);
      }

      mqttpub(counters)
      // console.log(countdata)
      // console.log(counters)
    } else {
      console.error('Wrong Format:', topic);
      logs('Errorlog', `Wrong Format: ${topic}/ ${msg}`, ServiceName);
    }

    }

  } catch (error) {
    console.error('Error processing message:', error);
    errlog.logError(error, sourcefile, `processMessage`);
  }
}

function updateCounter(counter, key) {
  counter[key] = (counter[key] || 0) + 1;
}

function updateCurrentHourCounter(counter) {
  const currentHour = new Date().getHours(); // Get current hour (0-23)
  counter[currentHour] = (counter[currentHour] || 0) + 1;
}


// -----------------------------
// 5. Event Listeners
// -----------------------------

client.on('connect', onConnect);
client.on('message', onMessage);
client.on('close', onClose);

// -----------------------------
// 6. Initialization & Main Execution
// -----------------------------

async function initialize() {
  try {
    counters.Models = await sqlfunctions.GetCountByModel(AreaID);
    counters.Yield = await sqlfunctions.GetCountbyYield(AreaID);
    counters.Employees = await sqlfunctions.GetCountbyEmployee(AreaID)
    counters.Stations = await sqlfunctions.GetCountbyStation(AreaID)
    mqttpub(counters)

  } catch (err) {
      console.error('Error during initialization:', err);
  }
}

initialize().then(() => {
  logs('Status', 'Active', 'Status')
});



let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 6)];
rule.hour = [4, 16];
rule.minute = 0;
rule.tz = 'America/Denver';

let clearDataJob = schedule.scheduleJob(rule, async function () {
  try {
    // Ensure saveToMongoDB is complete before proceeding
    await saveToMongoDB('ELP', ServiceName, 'EfficiencyTracker', counters, bn);

    // Iterate over the properties of the Stations object
    for (const key in counters.Stations) {
      if (counters.Stations.hasOwnProperty(key)) {
        counters.Stations[key] = 0;
      }
    }

    // Iterate over the properties of the HourlyProduction object
    for (const key in counters.HourlyProduction) {
      if (counters.HourlyProduction.hasOwnProperty(key)) {
        counters.HourlyProduction[key] = 0;
      }
    }

    counters.Models = {};
    counters.Yield = {};
    counters.Employees = {};
    uniqueSerialsset.clear();
    mqttpub(counters)

    console.log('Data has been cleared.');
  } catch (error) {
    console.error('Error clearing data:', error);
    errlog.logError(error, sourcefile, `clearDataJob`);
  }
});


