/*
Summary: The server.js is used to start the backend server with HTTPS and CORS enabled.
*/

require('dotenv').config();

var express = require('express');
var serveStatic = require('serve-static');
var cors = require('cors');
var https = require('https');
var http = require('http');
var fs = require('fs');
var path = require('path');

var app = require('./controller/app.js');

var port = Number(process.env.PORT || 443);
var useHttp = process.env.USE_HTTP === '1';


// Configure CORS
app.use(cors({
    origin: ['http://localhost:3001', 'https://localhost:3001'],
    credentials: true
}));


// Serve frontend files
app.use(serveStatic(__dirname + '/public'));


function startServer() {

    if (useHttp) {
        http.createServer(app).listen(port, function () {
            console.log('HTTP Server listening on port %s', port);
        });
        return;
    }

    var keyPath = path.join(__dirname, 'certs', 'localhost-key.pem');
    var certPath = path.join(__dirname, 'certs', 'localhost.pem');

    var options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };

    https.createServer(options, app).listen(port, function () {
        console.log('Secure HTTPS Server Hosted at https://localhost:%s', port);
    });
}

startServer();