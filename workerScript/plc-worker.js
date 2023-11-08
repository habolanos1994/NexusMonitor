const fs = require("fs");
const TagGroupReader = require("../funtions/TagGroupReader");
const TagIndividualReader = require("../funtions/TagIndividualReader");
const { mqttpub } = require("../funtions/mqttpublish");
const { saveToMongoDB } = require("../funtions/mongo");
const { PLCConnectionStatus } = require('../funtions/PLCInfoFetcher');
const schedule = require("node-schedule");
const path = require('path');
const { parentPort, workerData } = require('worker_threads');

const sourcefile = path.basename(__filename);

const {
  ServiceName,
  WorkerScript,
  ControllerName,
  IPAddress,
  TagConfigPath,
  Plant,
  Area,
  Line,
  EmissionFrequency,
  ControllerType,
} = workerData;

let mqttTopicPrefix = `${Plant}/${Area}/${Line}`;
const bn = `${Plant}_${Area}_${Line}`;

const tagConfigFullPath = path.join(__dirname, '..', 'jsonfiles', TagConfigPath);
const tagConfigContent = fs.readFileSync(tagConfigFullPath, 'utf8');
const tagConfigs = JSON.parse(tagConfigContent);



const plcGroupConnection = new TagGroupReader(ServiceName, WorkerScript, ControllerName, IPAddress, TagConfigPath, Plant, Area, Line, EmissionFrequency, ControllerType);
const plcIndividualConnection = new TagIndividualReader(ServiceName, WorkerScript, ControllerName, IPAddress, TagConfigPath, Plant, Area, Line, EmissionFrequency, ControllerType);

let Plcdata = {}


plcGroupConnection.on("error", handleError);
plcIndividualConnection.on("error", handleError);

plcGroupConnection.on("tagsmap", mapTagRead);
plcIndividualConnection.on("tagsRead", handleTagRead);

let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 6)];
rule.hour = [3, 15];
rule.minute = 0;
rule.tz = 'America/Denver';

let saveToMongoDBJob = schedule.scheduleJob(rule, function () {
  if (Array.isArray(Plcdata)) {
    Plcdata.forEach((data, key) => {
      saveToMongoDB(Area, Line, key, key === 'Mark012' ? { data } : data, bn);
    });
  } else {
    console.error('Plcdata is not an array.');
  }
});

async function logs(type, message, event) {
  parentPort.postMessage({
    type: type,
    message: message,
    source: sourcefile,
    ServiceName: ServiceName,
    event: event
  });
}

async function startGroupConnection() {
  await plcGroupConnection.connectToPLC();
}

async function startIndividualConnection() {
  await plcIndividualConnection.connectToPLC();
}

function handleError(error) {
  console.error(`Error in PLC ${ControllerName}:`, error.message);
  logs('Errorlog', error, ControllerName);
  logs('restart',`Controller: ${ControllerName}, ${JSON.stringify(error.message, null, 2)}`,'Fail')
}

function mapTagRead(tagvalues) {

  if (!tagvalues || typeof tagvalues.StationName === 'undefined') {
    console.error(`StationName is undefined in tagvalues: ${tagvalues.StationName}:${ControllerName}`);
    logs('restart',`Controller: ${ControllerName}, ${JSON.stringify(tagvalues, null, 2)}`,'Fail')
    return;
  }

  const stationName = tagvalues.StationName; // Correct the case to match the variable usage below
  Plcdata[stationName] = tagvalues;

  const mqttTopic = `${mqttTopicPrefix}/${stationName}/DDATA`; // Use the corrected variable name
  // console.log(`Publishing to MQTT topic: ${mqttTopic}`);
  mqttpub(mqttTopic, Plcdata[stationName], bn); // Use the corrected variable name
  logs('Eventlog',`Controller: ${ControllerName} Plcdata:${JSON.stringify(tagvalues, null, 2)}`,'first scan')

  startIndividualConnection(); 
}

async function handleTagRead(tag) {
  
  let tagConfig = tagConfigs.find(tc => tc.name === tag.name);
  if (!tagConfig) {
    logs('Errorlog', `Configuration not found for tag: ${tag.name}`, ControllerName);
    console.error(`Configuration not found for tag: ${tag.name}`);
    return;
  }

  const { Index1 = '', Index2 = '', alias, StationName } = tagConfig;

  if (!Plcdata || typeof Plcdata !== 'object') {
    logs('Errorlog', 'Plcdata is not defined or not an object:', ControllerName);
    console.error('Plcdata is not defined or not an object:', Plcdata);
    return;
  }
  
  const stationData = Plcdata[StationName];

  if (!stationData) {
    logs('Errorlog',`Station data not found for: ${StationName}`, ControllerName);
    console.error(`Station data not found for: ${StationName}`);
    return;
  }

  if (!stationData[Index1]) {
    stationData[Index1] = { values: {} };
  }

  if (Index2) {
    if (!stationData[Index1].values[Index2]) {
      stationData[Index1].values[Index2] = {}; 
    }
    stationData[Index1].values[Index2][alias] = tag.value;
  } else {
    stationData[Index1].values[alias] = tag.value;
  }

  const mqttTopic = `${mqttTopicPrefix}/${StationName}/DDATA`;
  mqttpub(mqttTopic, stationData, bn); // Ensure this matches the corrected variable name
  
};





async function main() {
  const checkConnection = await PLCConnectionStatus(IPAddress, TagConfigPath, ControllerName);


  if (checkConnection.PLCStatus) {
    logs('Eventlog',`Controller: ${ControllerName} checkConnection:${JSON.stringify(checkConnection, null, 2)}`,'starting')
    logs('Status', 'Active', 'Status')
    startGroupConnection();
  } else {
    logs('restart',`Controller: ${ControllerName} checkConnection:${JSON.stringify(checkConnection, null, 2)}`,'Fail')
    console.error('Bad connection, no operations will be started.');
  }
}

main();
