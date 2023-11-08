const { ControllerManager } = require("st-ethernet-ip");
const fs = require("fs");
const EmailService = require('../funtions/smtp');
const emailService = new EmailService();
const EventEmitter = require('events');
const ErrorLogger = require('../funtions/errorlog');
const logger = new ErrorLogger();
const path = require('path');
const sourcefile = path.basename(__filename);



class PLC extends EventEmitter {
    constructor(ServiceName, WorkerScript, ControllerName, plcIpAddress, TagConfigPath, Plant, Area, Line, EmissionFrequency, ControllerType) {
        super();
        // Initialize ControllerManager
        this.controllerManager = new ControllerManager();

        const tagConfigFullPath = path.join(__dirname, '..', 'jsonfiles', TagConfigPath);
        const tagConfigContent = fs.readFileSync(tagConfigFullPath, 'utf8');
        this.tagConfigs = JSON.parse(tagConfigContent);

        this.currentReconnectAttempts = this.maxReconnectAttempts || 3;
        this.maxReconnectDelay = 1200000;
        this.values = {};
        this.ErrorSet = new Set();
        this.consecutiveFailureCount = 0;
        this.ControllerName = ControllerName;
        this.plcIpAddress = plcIpAddress;

        this.controller = this.controllerManager.addController(plcIpAddress,0, 500, true, EmissionFrequency);
        this.connectToPLC()
    }

  attachEventListeners() {
    this.controller.on('TagChanged', this.handleTagChange.bind(this));
    this.controller.on('Disconnected', this.handleDisconnect.bind(this));
    this.controller.on('Error', this.handleError.bind(this));
  }

  handleTagChange(tag, prevValue) {
    //  console.log(tag.name, 'changed from', prevValue, '=>', tag.value);

     const data = {
      name:tag.name,
      value:tag.value
     }

     this.emit('tagsRead', data);


}


  handleDisconnect() {
    emailService.send(`Mqtt service plc Report Plc disconnected`);
    this.emit('disconnected');
  }

  handleError(err) {

    logger.logError(err, sourcefile, 'this.controller.on(Error)');
    this.reconnectAttempts--;
    if (this.reconnectAttempts > 0) {
      console.log(`Retrying connection. Attempts remaining: ${this.reconnectAttempts}`);
      setTimeout(() => this.connectToPLC(), this.maxReconnectDelay);
    } else {
      this.emit('error', err);
    }
  }

  async addTagsToController() {
    this.tags = this.tagConfigs.map(tag => this.controller.addTag(tag.name));
   await this.attachEventListeners();
  }

  async connectToPLC() {
    try {
      await this.controller.connect(this.plcIpAddress);
      console.log(`Connected to PLC ${this.ControllerName}`);
      await this.addTagsToController();
    } catch (error) {
      logger.logError(error, sourcefile, 'connectToPLC');
      this.emit('error', error);
    }
  }
}

module.exports = PLC;
