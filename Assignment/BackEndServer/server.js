/*
Summary: The server.js is used to start the backend server with HTTPS and CORS enabled.
*/

var express = require('express');
var serveStatic = require('serve-static');
var cors = require('cors');
var https = require('https');
var fs = require('fs');

var app = require('./controller/app.js');

var port = 443;


// Configure CORS
app.use(cors({
    origin: 'https://localhost:3001',
    credentials: true
}));


// Serve frontend files
app.use(serveStatic(__dirname + '/public'));


// TLS Certificate Configuration
var options = {

    key: fs.readFileSync(
        './certs/localhost-key.pem'
    ),

    cert: fs.readFileSync(
        './certs/localhost.pem'
    )

};


// Start HTTPS Server
var server = https.createServer(
    options,
    app
);


server.listen(port, function(){

    console.log(
        'Secure HTTPS Server Hosted at https://localhost:%s',
        port
    );

});