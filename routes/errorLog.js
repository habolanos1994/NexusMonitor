const express = require('express');
const fs = require('fs');
const router = express.Router();
const path = require('path')
const sourcefile = path.basename(__filename);


router.get('/getErrorLog', (req, res) => {
    fs.readFile('../csvfiles/errorlog.csv', 'utf8', (err, data) => {
        if (err) {
            logError(err, 'getErrorLog', sourcefile);
            res.status(500).send("Error reading error log");
        } else {
            res.type('text/csv');
            res.send(data);
        }
    });
});

router.post('/clearErrorLog', (req, res) => {
    fs.writeFile('errorlog.csv', '', (err) => {
        if (err) {
            logError(err, 'clearErrorLog', sourcefile);
            res.status(500).send("Error clearing error log");
        } else {
            res.sendStatus(200);
        }
    });
});

module.exports = router;