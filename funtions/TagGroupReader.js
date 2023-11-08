const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const encoder = new TextDecoder();
const EmailService = require('../funtions/smtp');
const emailService = new EmailService();
const EventEmitter = require('events');
const ErrorLogger = require('../funtions/errorlog');
const logger = new ErrorLogger();
const path = require('path');

const sourcefile = path.basename(__filename);

class PLC extends EventEmitter {
  constructor(ServiceName, WorkerScript, ControllerName, IPAddress, TagConfigPath, Plant, Area, Line, EmissionFrequency, ControllerType) {
    super();
    this.PLC = new Controller({ timeout: 5000 });

    // Corrected section begins
    const tagConfigFullPath = path.join(__dirname, '..', 'jsonfiles', TagConfigPath);
    const tagConfigContent = fs.readFileSync(tagConfigFullPath, 'utf8');
    this.tagConfigs = JSON.parse(tagConfigContent);

    this.values = {};
    this.ErrorSet = new Set();
    this.consecutiveFailureCount = 0;
    this.ControllerName = ControllerName;
    this.IPAddress = IPAddress;


    this.tags = this.tagConfigs.map((config) => {
      //console.log(config);
      return this.PLC.newTag(config.name);
    });


    this.PLC.on('Disconnected', () => {

      this.emit('disconnected');
    });

    this.PLC.on('Error', (err) => {
      console.log(err)
      logger.logError(err, sourcefile, ServiceName, 'PLC tag read error');
      this.emit('error', error);
    });

    this.PLC.on('connected', () => {
      console.log(`PLC ${this.ControllerName} is now connected.`);
      this.emit('connected');  // if you want to emit this to other parts of your application

    });


  }

  async readTagsAndUpdateValues() {
    this.values = {};
    let hasError = false;

    for (let i = 0; i < this.tags.length; i++) {

      const tag = this.tags[i];
      const config = this.tagConfigs[i];
      const Index1 = config.Index1;
      const Index2 = config.Index2;
      const stationName = config.StationName;
      let tagValue;

      if (!this.values[stationName]) {
        this.values[stationName] = {};
      }

      if (Index1 && !this.values[stationName][Index1]) {
        this.values[stationName][Index1] = { values: {} };
      }

      if (Index2 && !this.values[stationName][Index1].values[Index2]) {
        this.values[stationName][Index1].values[Index2] = {};
      }

      try {
        await this.PLC.readTag(tag);
        if (tag.value instanceof Buffer) {
          const arr = new Uint8Array(tag.value);
          const slicedArr = arr.slice(1);
          const filteredArr = slicedArr.filter(byte => byte !== 0);
          const str = encoder.decode(filteredArr);
          tagValue = str;
        } else {
          tagValue = tag.value;
        }
      } catch (error) {
        logger.logError(error, sourcefile, 'readTagsAndUpdateValues');
        const errorMessage = `PLC ${this.ControllerName}: Error reading tag '${config.name}': ${error.message}`;
        this.ErrorSet.add(errorMessage);
        console.error(errorMessage);
        tagValue = 'error';
        hasError = true;
      }

      if (Index2) {
        this.values[stationName][Index1].values[Index2][config.alias] = tagValue;
      } else {
        this.values[stationName][Index1].values[config.alias] = tagValue;
      }

    }


    for (const stationName in this.values) {
      const data = {
        StationName: stationName,
        ...this.values[stationName],
      };
      this.emit('tagsmap', data);

    }


  }

  async connectToPLC() {
    try {
      await this.PLC.connect(this.IPAddress, 0).then(() => {
        this.emit('Connected', true);
        console.log(`Connected to PLC ${this.ControllerName}`);
        this.readTagsAndUpdateValues();
      });
    } catch (error) {
      logger.logError(error, sourcefile, 'connectToPLC');
      this.handleReconnection(error); 
    }
  }

  async handleReconnection(error) {
    this.emit('error', error);

  }


}

module.exports = PLC;




