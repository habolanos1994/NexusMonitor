const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

const MAX_LOG_ENTRIES = 5000;
const QUEUE_PROCESS_INTERVAL = 1000; // 1 second

class ErrorLogger {
    constructor() {
        this.logFilePath = path.join(__dirname, '..', 'csvFiles', 'errorlog.csv');
        this.logQueue = [];
        this.isProcessing = false;

        // Start the processing loop
        setInterval(() => this.processQueue(), QUEUE_PROCESS_INTERVAL);
    }

    async logError(errorMessage, sourcefile, ServiceName,sourcefunction) {
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const logMessage = `${timestamp}, ${sourcefile}, ${ServiceName}, ${sourcefunction}, ${errorMessage}`;
        
        this.logQueue.push(logMessage);
    }

    async processQueue() {
        if (this.isProcessing || this.logQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const currentLogMessage = this.logQueue.shift();

        try {
            let data = '';
            try {
                data = await fs.readFile(this.logFilePath, 'utf8');
            } catch (readErr) {
                if (readErr.code === 'ENOENT') {
                    await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
                    await fs.writeFile(this.logFilePath, '');
                } else {
                    throw readErr;
                }
            }

            let logLines = data.split('\n');
            if (logLines.length >= MAX_LOG_ENTRIES) {
                logLines = logLines.slice(logLines.length - MAX_LOG_ENTRIES);
            }
            logLines.push(currentLogMessage);

            await fs.writeFile(this.logFilePath, logLines.join('\n'));

        } catch(err) {
            console.log('Error handling the log file: ', err);
        }

        this.isProcessing = false;
    }
}

module.exports = ErrorLogger;
