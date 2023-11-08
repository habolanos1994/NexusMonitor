// -----------------------------
// 1. Imports
// -----------------------------
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const ApiRequest = require('../funtions/APIrequest')
const schedule = require('node-schedule');
const EmailService = require('../funtions/smtp');
const emailService = new EmailService();
const { findmodel } = require('../funtions/model');
const { saveToMongoDB } = require("../funtions/mongo")
const { parentPort, workerData } = require('worker_threads');

// -----------------------------
// 2. Constants & Configurations
// -----------------------------
const hostname = os.hostname();
const sourcefile = path.basename(__filename);
// const Plant = 'ELP';
// const Area = 'Returns';
// const Line = 'Counters';
// const mqttTopicPrefix = `${Plant}/${Area}/${Line}`;
// const bnTopicPrefix = `${Plant}_${Area}_${Line}`
// const topicpub = `${mqttTopicPrefix}/DDATA`;
// const bn = `${bnTopicPrefix}_DDATA`
const csvFileDir = path.join(__dirname, '../csvFiles');


var modeldata = {
  serial: '',
  model: '',
  FilterResult: '',
  Unique: false,
}

const {
  ServiceName,
  WorkerScript,
  AreaID,
  SubscriptionTopic,
  MQTTDDATATopic,
  Serialized,
} = workerData;


const bn = MQTTDDATATopic.replace(/\//g, '_');


const mqttOptions = {
  host: 'pcv1engmqtt01',
  port: 1883,
  protocol: 'mqtt',
  rejectUnauthorized: false,
  clientId: `client${hostname}PLC${uuidv4()}`,
};



// -----------------------------
// 3. Global Variables
// -----------------------------
let client = mqtt.connect(mqttOptions);
let isConnected = false;

let messageQueue = [];
let seq = 0;

let TransactionsSerialsset = new Set();
let uniqueSerialsset = new Set();
let SickSerialsSet = new Set();
let KeyenceSerialsSet = new Set();
let SorterSerialsSet = new Set();
let QRASerialsSet = new Set();
let NoRaSet = new Set();

// Serials paths
const serialFiles = {
  KeyenceSerials: path.join(csvFileDir, 'KeyenceSerials.csv'),
  SickSerials: path.join(csvFileDir, 'SickSerials.csv'),
  SorterSerials: path.join(csvFileDir, 'SorterSerials.csv'),
  QRASerials: path.join(csvFileDir, 'QRASerials.csv'),
  NoRa: path.join(csvFileDir, 'NoRa.csv'),
  AllSerials: path.resolve(csvFileDir, 'serials.csv')
};


var counters = {
  Cameras: {},
  Models: {},
  HourlyCounts: {},
  Employees: {},
  Transactions: {},
};

var tempcounters = {
  HourlyProduction: {},
  HourlyRSP: {},
  HourlyDNS: {},
  HourlyAutoTrack: {},
}


// -----------------------------
// 4. Function Definitions
// -----------------------------

async function logs(type, message, event) {
  parentPort.postMessage({
    type: type,
    message: message,
    source: sourcefile,
    ServiceName : ServiceName,
    event: event
});
}



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
  clearInterval();
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
  logs('restart',`Service Name: ${ServiceName} MQTT Close`,'Fail')
}


const folderPath = path.join(__dirname, '../jsonfiles');
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
}

// Function to save the count to a JSON file
function saveCountToFile(counters, fileName = 'counters.json') {
  const filePath = path.join(folderPath, fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(counters, null, 2));
  } catch (error) {
    console.error('An error occurred while saving the counters:', error);
  }
}

function loadCountFromFile(fileName = 'counters.json') {
  const filePath = path.join(folderPath, fileName);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (data.Cameras) counters.Cameras = data.Cameras;
      if (data.Models) counters.Models = data.Models;
      if (data.HourlyCounts) counters.HourlyCounts = data.HourlyCounts;
      if (data.Employees) counters.Employees = data.Employees;
      if (data.Transactions) counters.Transactions = data.Transactions;

      return data;  // This line was changed
    } else {
      saveCountToFile({
        Cameras: {},
        Models: {},
        HourlyCounts: {},
        Employees: {},
        Transactions: {},
      }, fileName);
      return {
        Cameras: {},
        Models: {},
        HourlyCounts: {},
        Employees: {},
        Transactions: {},
      };
    }
  } catch (error) {
    console.error('An error occurred while loading the counters:', error);
    saveCountToFile({
      Cameras: {},
      Models: {},
      HourlyCounts: {},
      Employees: {},
      Transactions: {},
    }, fileName);
    return {
      Cameras: {},
      Models: {},
      HourlyCounts: {},
      Employees: {},
      Transactions: {},
    };
  }
}


function loadSerialsFromFile(filePath, set) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const serials = data.split('\n').filter(serial => serial.trim() !== '');
      for (const serial of serials) {
        set.add(serial);
      }
      console.log(`Loaded ${set.size} unique serial numbers from file ${filePath}.`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      logs('Errorlog',error, 'loadSerialsFromFile')

    }
  }
}

async function getallcount() {
  try {
    counters.Cameras.TotalReceiversScan = uniqueSerialsset.size;
    counters.Cameras.TotalSickClarify = SickSerialsSet.size;
    counters.Cameras.TotalKeyenceClarify = KeyenceSerialsSet.size;
    counters.Cameras.TotalQRA = QRASerialsSet.size;
    counters.Cameras.TotalSorter = SorterSerialsSet.size;
    counters.Cameras.TotalNoRAReceivers = NoRaSet.size;
    mqttpub(counters)

  } catch (error) {
    console.error('Error in getallcount:', error);
    logs('Errorlog',error, 'getallcount')
  }
}


function mqttpub(messagepub) {
  saveCountToFile(messagepub)
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



    if (msg && msg.Data && msg.Data.ReceiverData && 'SerialNumber' in msg.Data.ReceiverData) {
      serial = msg.Data.ReceiverData['SerialNumber'];
    } else if (msg && 'serial' in msg) {
      serial = msg.serial;
    }

    if (serial && serial.startsWith('R') && serial.length === 11) {
      serial = await ApiRequest.GetSerialNumberByCAID(serial);
    }

    let model = await findmodel(serial);
    modeldata.serial = serial;
    modeldata.model = model;

    if (model != 'undefined') {



      if (!TransactionsSerialsset.has(serial) && !topic.includes("SickClarify") && !topic.includes("Keyence")) {

        clarify = await ApiRequest.GetRecordTransaction(serial);

        let Transactions;

        if (["AUTO_TRACK", "RSP/SUB", "DNS"].includes(clarify.InboundTrackingDetails)) {

          TransactionsSerialsset.add(serial);

          Transactions = clarify.InboundTrackingDetails;


        } else {
          Transactions = 'error';
          updateCounter(counters.Transactions, Transactions);
          updateCurrentHourCounter('NonValid');
        }

        if (Transactions === 'AUTO_TRACK') {
          updateCurrentHourCounter('AutoTrack');
        } else if (Transactions === 'RSP/SUB') {
          updateCurrentHourCounter('RSP');
        } else if (Transactions === 'DNS') {
          updateCurrentHourCounter('DNS');
        }

        // Update other counters
        updateCounter(counters.Transactions, Transactions);
        updateCounter(counters.Employees, clarify.Owner);

      }
    

      if (!uniqueSerialsset.has(serial)) {
        //updateCurrentHourCounter('Total')
        updateCounter(counters.Models, modeldata.model);
        uniqueSerialsset.add(serial);
        fs.appendFileSync(serialFiles.AllSerials, serial + '\n');
        modeldata.Unique = true;
      }

      if (topic.includes('SickClarify')) {
        if(!SickSerialsSet.has(serial)){
          SickSerialsSet.add(serial);
          fs.appendFileSync(serialFiles.SickSerials, serial + '\n');
          modeldata.FilterResult = 'SickClarify';
        }
      } else if (topic.includes('Keyence')) {
        if(!KeyenceSerialsSet.has(serial)){
          KeyenceSerialsSet.add(serial);
          fs.appendFileSync(serialFiles.KeyenceSerials, serial + '\n');
          modeldata.FilterResult = 'Keyence';
        }
      } else if (topic.includes('Receiver_Sorter')) {
        SorterSerialsSet.add(serial);
        fs.appendFileSync(serialFiles.SorterSerials, serial + '\n');
        modeldata.FilterResult = 'Receiver_Sorter';
      } else if (topic.includes('QRA')) {
        QRASerialsSet.add(serial);
        fs.appendFileSync(serialFiles.QRASerials, serial + '\n');
        modeldata.FilterResult = 'QRA';
        if (msg.Data.ReceiverResultData['TestResult'] !== 'QRA|WHS') {
          NoRaSet.add(serial);
          fs.appendFileSync(serialFiles.NoRa, serial + '\n');
        }
      }

      getallcount();

    } 

  } catch (error) {
    console.error('Error processing message:', error);
    logs('Errorlog',error, 'Error processing message')
  }
}


function updateCounter(counter, key) {
  counter[key] = (counter[key] || 0) + 1;
}


function updateCurrentHourCounter(counterType) {

  const currentHour = new Date().getHours(); // Get current hour (0-23)

  // Initialize the hour if it does not exist in the consolidated counter
  if (!counters.HourlyCounts[currentHour]) {
    counters.HourlyCounts[currentHour] = {};
  }

  // Initialize the counter type for the hour if it does not exist
  if (!counters.HourlyCounts[currentHour][counterType]) {
    counters.HourlyCounts[currentHour][counterType] = 0;
  }

  // Increment the counter for the specific type and hour
  counters.HourlyCounts[currentHour][counterType]++;
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

    await loadSerialsFromFile(serialFiles.AllSerials, uniqueSerialsset);
    await loadSerialsFromFile(serialFiles.SickSerials, SickSerialsSet);
    await loadSerialsFromFile(serialFiles.KeyenceSerials, KeyenceSerialsSet);
    await loadSerialsFromFile(serialFiles.SorterSerials, SorterSerialsSet);
    await loadSerialsFromFile(serialFiles.QRASerials, QRASerialsSet);
    await loadSerialsFromFile(serialFiles.NoRa, NoRaSet);
    await loadCountFromFile();

    //getallcount();
  } catch (err) {
    console.error('Error during initialization:', err);
    logs('Errorlog',err, 'Error during initialization')
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

    await saveToMongoDB(Area, Line, Line, counters, bn);

    uniqueSerialsset.clear();
    SickSerialsSet.clear();
    KeyenceSerialsSet.clear();
    SorterSerialsSet.clear();
    QRASerialsSet.clear();
    NoRaSet.clear();
    TransactionsSerialsset.clear();
    
    Object.keys(counters).forEach(key => {
      for (const innerKey in counters[key]) {
        counters[key][innerKey] = 0;
      }
    });
    
    Object.keys(tempcounters).forEach(key => {
      for (const innerKey in tempcounters[key]) {
        tempcounters[key][innerKey] = 0;
      }
    });

    counters.Employees ={};
    counters.Models ={};
    fs.writeFileSync(serialFiles.AllSerials, '');
    fs.writeFileSync(serialFiles.SickSerials, '');
    fs.writeFileSync(serialFiles.KeyenceSerials, '');
    fs.writeFileSync(serialFiles.SorterSerials, '');
    fs.writeFileSync(serialFiles.QRASerials, '');
    fs.writeFileSync(serialFiles.NoRa, '');
    mqttpub(counters);
    //console.log('Data has been cleared.');
  } catch (error) {
    console.error('Error clearing data:', error);
    logs('Errorlog',error, 'clearDataJob')

    
  }
});

