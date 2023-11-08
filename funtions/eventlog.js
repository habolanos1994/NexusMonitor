const MAX_LOG_ENTRIES = 500;
let uniqueCounter = 0;
let lastTime = 0;

class Eventlog {
    constructor() {
        this.eventlogset = new Map();
        this.currentSize = 0;
    }

    eventlog(Message, sourceFile, serviceName, sourceFunction) {
        const timestamp = this.getFormattedTimestamp();
    
        // Check if Message is an object and stringify it
        if (typeof Message === 'object' && Message !== null) {
            try {
                // Convert the entire object to a JSON string
                Message = JSON.stringify(Message);
            } catch (error) {
                // Handle any errors that may occur during stringification
                console.error('Error stringifying message:', error);
                Message = 'Error in message format';
            }
        } else if (typeof Message === 'string') {
            // Check if the string contains '[object Object]'
            if (Message.includes('[object Object]')) {
                // Try to fix it only if you have access to the original object here
                // Otherwise, consider logging an error or a placeholder message
                Message = 'Invalid message format';
            }
        }
    
        // Continue with creating the log entry
        const logEntry = {
            timestamp: timestamp,
            sourceFile: sourceFile,
            serviceName: serviceName,
            sourceFunction: sourceFunction,
            Message: Message // This will either be a stringified object or a string
        };
        this.addToQueue(logEntry);
    }

    getFormattedTimestamp() {
        const now = Date.now();
        if (lastTime === now) {
            uniqueCounter++;
        } else {
            uniqueCounter = 0;
            lastTime = now;
        }
        const date = new Date();
        return `${date.toISOString().replace('T', ' ').replace('Z', '').substring(0, 19)}.${uniqueCounter.toString().padStart(3, '0')}`;
    }

    addToQueue(logEntry) {
        const timestampKey = logEntry.timestamp;
        this.eventlogset.set(timestampKey, JSON.stringify(logEntry));
        this.currentSize++;

        if (this.currentSize > MAX_LOG_ENTRIES) {
            const oldestKey = this.eventlogset.keys().next().value;
            this.eventlogset.delete(oldestKey);
            this.currentSize--;
        }
    }

    getAllLogs() {
        return Array.from(this.eventlogset.values()).map(log => JSON.parse(log));
    }

    getLogByTimestamp(timestamp) {
        const log = this.eventlogset.get(timestamp);
        return log ? JSON.parse(log) : null;
    }
}

const instance = new Eventlog();
module.exports = instance;
