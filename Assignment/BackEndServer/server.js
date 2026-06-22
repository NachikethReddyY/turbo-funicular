/*
Summary: The server.js is used to start the backend server with CORS enabled.
*/

var express = require('express');
var serveStatic = require('serve-static');
var cors = require('cors'); // 1. Import the cors package
var app = require('./controller/app.js');

var port = 8081;

// 2. Configure CORS to strictly allow your frontend port
app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
}));

app.use(serveStatic(__dirname + '/public')); 

var server = app.listen(port, function(){
    console.log('Web App Hosted at http://localhost:%s', port);
});