const express = require('express');
const fs = require('fs');
const router = express.Router();
const path = require('path')
const sourcefile = path.basename(__filename);
const passport = require('passport'); // Import passport
const sqlModule = require('../funtions/sql.js'); 
const APIfuntions = require('../funtions/APIrequest.js')
const logError = require('../funtions/errorlog.js').logError;
const logService = require('../funtions/eventlog');
const bodyParser = require('body-parser');


router.get('/getjson', async (req, res) => {
    try {
        const data = await APIfuntions.readConfigAndTagFiles();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

router.get('/mongo/getTagConfigs', async (req, res) => {

    try {
        await mongofunction.connectDB();

        const data = await mongofunction.getTagConfigs()
        res.send(data)

    } catch (err) {
        console.error('An error occurred:', err);
        res.status(500).send('Server error');
    }

});

router.get('/DataCollector/Status', async (req, res) => {

    try {

        const data = await APIfuntions.DataCollectorStatus()
        res.send(data)

    } catch (err) {
        console.error('An error occurred:', err);
        res.status(500).send('Server error');
    }

});

router.get('/DataCollector/Restart', async (req, res) => {

    try {

        const data = await APIfuntions.DataCollectorRestart()
        res.send(data)

    } catch (err) {
        console.error('An error occurred:', err);
        res.status(500).send('Server error');
    }

});

router.get('/Eventlog', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {

        const logs = logService.getAllLogs();
        const logArray = Array.isArray(logs) ? logs : [logs];
        res.json({
            success: true,
            logEntries: logArray
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'An error occurred while fetching logs.', error: error.message });
    }
});



module.exports = router;