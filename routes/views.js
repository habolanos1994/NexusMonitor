const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
router.get('/ConfigPLC', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'configplc.html')));
router.get('/DataCollector', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'DataCollector.html')));
router.get('/PLCdata', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'PLCdata.html')));
router.get('/errorLog', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'errorLog.html')));
router.get('/recovery', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'recovery.html')));
router.get('/wap', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'WAP.html')));
router.get('/unauthorized', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'unauthorized.html')));
router.get('/Services', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'worker-manager.html'));
  });
  router.get('/eventlog', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'eventlog.html'));
  });
module.exports = router;
