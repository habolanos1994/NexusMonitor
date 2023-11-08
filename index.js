const express = require('express');
const https = require('https');
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const logService = require('./funtions/eventlog');
const ErrorLogger = require('./funtions/errorlog')
const logError = new ErrorLogger();
// const sourcefile = path.basename(__filename);

const sslOptions = require('./website-config/sslConfig');
const setupMiddlewares = require('./website-config/middlewareConfig');
const setupPassport = require('./website-config/passportConfig');
const routes = require('./routes');
const { notFoundHandler, generalErrorHandler } = require('./website-config/errorHandler');
const { port, sourcefile, hostname } = require('./website-config/variables');

const configFilePath = path.join(__dirname, "./jsonfiles/NexusMonitor-config.json");
const configs = JSON.parse(fs.readFileSync(configFilePath));

const RELAUNCH_DELAY_MS = 3000; // Example relaunch delay. Adjust as needed.

const workers = {};
let workerStatus = {}; // Initialize this somewhere in your global scope
const app = express();

// Configurations
setupMiddlewares(app);
setupPassport();

// Routes
routes(app);

app.get('/workerStatus', (req, res) => {
    let status = [];
    for (const serviceName in workers) {
        status.push({
            serviceName: serviceName,
            status: workerStatus[serviceName] || "unknown"
        });
    }
    res.json(status);
});

app.post('/restartWorker', (req, res) => {
    const serviceName = req.body.serviceName;

    if (!serviceName || !workers[serviceName]) {
        return res.status(400).send('Invalid service name.');
    }

    workers[serviceName].terminate().then(() => {
        delete workers[serviceName];
        const config = configs.find(c => c.ServiceName === serviceName);
        if (config) {
            launchWorker(config);
            res.send(`Restarted worker for Service ${serviceName}`);
        } else {
            res.status(404).send('Service configuration not found.');
        }
    }).catch(err => {
        console.error(`Could not terminate worker for Service ${serviceName}:`, err);
        res.status(500).send(`Error while restarting Service ${serviceName}`);
    });
});

app.post('/restartAllWorkers', (req, res) => {
    const workerKeys = Object.keys(workers);
    
    Promise.all(workerKeys.map(key => workers[key].terminate())).then(() => {
        for (const key of workerKeys) {
            delete workers[key];
        }
        
        configs.forEach(launchWorker);
        res.send(`All workers restarted successfully.`);
    }).catch(err => {
        console.error(`Could not terminate one or more workers:`, err);
        res.status(500).send(`Error while restarting all workers.`);
    });
});

// Error Handlers
app.use(notFoundHandler);
app.use(generalErrorHandler);


function launchWorker(config) {
    let workerData = {};

    if (config.Protocol === "EthernetIP") {
        workerData = {
            ServiceName: config.ServiceName,
            WorkerScript: config.WorkerScript,
            ControllerName: config.Settings.ControllerName,
            IPAddress: config.Settings.IPAddress,
            TagConfigPath: config.Settings.TagConfigPath,
            Plant: config.Settings.Plant,
            Area: config.Settings.Area,
            Line: config.Settings.Line,
            EmissionFrequency: config.Settings.EmissionFrequency,
            ControllerType: config.Settings.ControllerType
        };
    } else if (config.Protocol === "MQTT") {
        workerData = {
            ServiceName: config.ServiceName,
            WorkerScript: config.WorkerScript,
            AreaID: config.Settings.AreaID,
            SubscriptionTopic: config.Settings.SubscriptionTopic,
            MQTTDDATATopic: config.Settings.MQTTDDATATopic,
            Serialized: config.Settings.Serialized
        };
    } else {
        console.log("No valid configuration", config);

        logError.logError(config, sourcefile, data.ServiceName, `Error`)
        return;
    }

    if (workers[workerData.ServiceName]) {
        console.warn(`Service ${workerData.ServiceName} already exists.`);
        return;
    }

    const workerPath = path.join(__dirname, 'workerScript', workerData.WorkerScript);
    



    for (const datavar in workerData){
        logService.eventlog(`${datavar}: ${workerData[datavar]}`, sourcefile, workerData.ServiceName, 'worklunch');
        workerStatus[workerData.ServiceName] = 'worklunch';
    }

    const worker = new Worker(workerPath, { workerData });

    worker.on("error", (error) => {
        workerStatus[workerData.ServiceName] = 'error';
        console.error(`Error in Service ${workerData.ServiceName}:`, error);
        logError.logError(error, sourcefile, workerData.ServiceName, `Error`)
    });
    
    worker.on("exit", (code) => {
        console.log(code)
        if (code !== 0) {
            workerStatus[workerData.ServiceName] = 'exit';
            console.error(`Service ${workerData.ServiceName} worker stopped with exit code ${code}`);
            logError.logError(code, sourcefile, workerData.ServiceName, `Error`)
            logService.eventlog('exit', workerData.ServiceName, code); 
            console.log(`Relaunching worker for Service ${workerData.ServiceName} due to failure.`);
            setTimeout(() => {
                launchWorker(config);
            }, RELAUNCH_DELAY_MS);
        }
    
        delete workers[workerData.ServiceName];
    });
    
    worker.on("message", (data) => {
        

        if (data.type === 'Errorlog') {
            logError.logError(data.message, data.source, data.ServiceName, data.event)

        } else if (data.type === 'Status'){
            workerStatus[data.ServiceName] = data.message
            logService.eventlog(data.message, data.source, data.ServiceName, data.event);

        }else if (data.type === 'Eventlog'){

            logService.eventlog(data.message, data.source, data.ServiceName, data.event);

        }else if (data.type === 'restart') {
            workerStatus[workerData.ServiceName] = 'restart';
            const logstring = `Restarting worker for Service ${data.source}`
            logService.eventlog(logstring, data.source, data.ServiceName, 'restart');

            workers[data.source].terminate().then(() => {
                delete workers[data.source];
                launchWorker(config);

            }).catch(err => {

                console.error(`Could not terminate worker for Service ${data.source}:`, err);
                logError.logError(err, data.source, data.ServiceName, 'error')
                
            });
        } 
    });
    
    workers[workerData.ServiceName] = worker;

}

// Launch workers for each config.
configs.forEach(launchWorker);


// Starting the server
https.createServer(sslOptions, app).listen(port, () => {
    console.log(`Server running at https://${hostname}:${port}/`);
  });