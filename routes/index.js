const viewRoutes = require('./views');
const errorLogRoutes = require('./errorLog');
const apiRoutes = require('./api');

module.exports = (app) => {
  app.use('/', viewRoutes);
  app.use('/errorLog', errorLogRoutes);
  app.use('/api', apiRoutes);
};
