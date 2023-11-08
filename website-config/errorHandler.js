const ErrorLogger = require('../funtions/errorlog');
const logger = new ErrorLogger();
const path = require('path');
const sourcefile = path.basename(__filename);

module.exports = {
  notFoundHandler: (req, res, next) => {
    let errMsg = `errorApiNotFound:${req.originalUrl},Requestor:${req.ip}`;
    res.status(404).send('Cannot GET /');
    logger.logError(errMsg,sourcefile,'nodejs express', 'errorApiNotFound')

  },
  
  generalErrorHandler: (err, req, res, next) => {
    logger.logError(err.message,sourcefile,'nodejs express', 'middleware')
    console.error(`Error: ${err.message}`);
    res.status(500).send('Server error');
  }
};
