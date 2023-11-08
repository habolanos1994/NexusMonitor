const fs = require("fs").promises;
const path = require("path");
const util = require('util');
const axios = require('axios');
const exec = util.promisify(require('child_process').exec);


async function readConfigAndTagFiles() {
    const configData = await fs.readFile(path.join(__dirname, "plc-configs.json"));
    const plcConfigs = JSON.parse(configData);
    const results = [];
  
    for (const config of plcConfigs) {
      const rawData = await fs.readFile(path.join(__dirname, config.tagConfigsFile));
      const tagData = JSON.parse(rawData);
      results.push({
        plcName: config.plcName,
        tagData
      });
    }
  
    return results;  // Return the result
  }
  

  async function DataCollectorStatus() {
    try {
      const { stdout, stderr } = await exec("sudo systemctl status DataCollectorPLC.service");
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return stderr;
      }
      return stdout;
    } catch (error) {
      console.error(`exec error: ${error}`);
      return error.message;
    }
}

  async function DataCollectorRestart() {
    try {
      const { stdout, stderr } = await exec("sudo systemctl restart DataCollectorPLC.service");
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return stderr;
      }
      return stdout;
    } catch (error) {
      console.error(`exec error: ${error}`);
      return error.message;
    }
  }
  
  async function getConnectionInfo() {
    try {
      const response = await axios.get('http://elp-mcp/DB_Connections/Connections.ini');
      const data = response.data;
  
      // Split the data into lines
      const lines = data.split('\n');
  
      // Initialize variables to store the filtered values
      let provider, driver, SERVER, UID, PWD;
  
      // Iterate through each line and extract the relevant values
      lines.forEach(line => {
        if (line.includes('SERVICEPRODProvider')) provider = line.split('=')[1].trim().replace(/"/g, '');
        if (line.includes('SERVICEPRODDriver')) driver = line.split('=')[1].trim().replace(/"/g, '');
        if (line.includes('SERVICEPRODServer')) SERVER = line.split('=')[1].trim().replace(/"/g, '');
        if (line.includes('SERVICEPRODUID')) UID = line.split('=')[1].trim().replace(/"/g, '');
        if (line.includes('SERVICEPRODPWID')) PWD = line.split('=')[1].trim().replace(/"/g, '');
      });
  
      // Construct the filtered connection information
      const connectionInfo = {
        provider,
        driver,
        SERVER,
        UID,
        PWD
      };
  
      return connectionInfo;
    } catch (error) {
      console.error('Error fetching connection information:', error.message);
      throw error;
    }
  }

  async function GetSerialNumberByCAID(CAID) {
    try {
      const response = await axios.post('https://mnet.global.dish.com/OracleProceduresAPI/api/Clarify/GetSerialNumberByCAID', {
        CAID: CAID
      });
  
      const data = response.data;
  
      // Check if the response contains 'SerialNumber'
      if (data && 'SerialNumber' in data) {
        return data.SerialNumber;
      } else {
        throw new Error('SerialNumber not found in the API response');
      }
  
    } catch (error) {
      console.error('Error fetching connection information:', error.message);
      throw error;
    }
  }

  async function GetRecordTransaction(SerialNumber) {
    try {
      const response = await axios.post('https://mnet.global.dish.com/OracleProceduresAPI/api/Clarify/GetInboundBySerial', {
        SerialNumber: SerialNumber
      });
  
      const data = response.data;
  
      // Check if the response contains 'SerialNumber'
      if (data && 'SerialNumber' in data) {
        const modifiedResponse = {
          InboundTrackingDetails: data.InboundTrackingDetails,
          Owner: data.Owner
        };
        return modifiedResponse;
      } else {
        throw new Error('Data not found in the API response');
      }
  
    } catch (error) {
      console.error('Error fetching connection information:', error.message);
      throw error;
    }
  }
  


module.exports = {readConfigAndTagFiles, DataCollectorStatus, DataCollectorRestart, getConnectionInfo, GetSerialNumberByCAID, GetRecordTransaction}