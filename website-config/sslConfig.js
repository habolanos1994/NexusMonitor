const path = require('path');
const fs = require('fs');

module.exports = {
  key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'server.key')),
  cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'IOTVLANServices_bundle.pem'))
};
