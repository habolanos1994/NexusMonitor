const express = require('express');
const ntlm = require('express-ntlm');
const passport = require('passport'); 
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
const rootPath = path.join(__dirname, '..');

module.exports = (app) => {
    // Middlewares
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(ntlm());
    app.use(session({ secret: 'your session secret', resave: false, saveUninitialized: false }));

    // Remove the following line:
    app.use('/js', express.static(path.join(rootPath, 'node_modules', 'papaparse', 'dist')));

    // Replace it with the following line:
    app.use('/papaparse', express.static(path.join(rootPath, 'node_modules', 'papaparse', 'dist')));


    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());

    app.use(express.static(path.join(rootPath, 'public')));
    app.use('/css', express.static(path.join(rootPath, 'public', 'css'))); // this line is added
    app.use('/js/papaparse', express.static(path.join(rootPath, 'node_modules', 'papaparse')));
    app.use('/libs', express.static(path.join(rootPath, 'node_modules')));
    app.use('/lib', express.static(path.join(rootPath, 'lib')));
    app.use('/scripts', express.static(path.join(rootPath, 'scripts')));
    app.use('/js', express.static(path.join(rootPath, 'public')));

    // Middleware to set headers
    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'Cache-Control');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Server', 'Linux/Rocky8');
        res.setHeader('X-Nodejs-Version', '18.15.0');
        res.setHeader('X-Powered-By', 'Node.js, Express');
        next();
    });

    app.use(passport.initialize());
    app.use(passport.session());

};