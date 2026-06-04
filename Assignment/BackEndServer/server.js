/*


Summary: The server.js is used to start the backend server.
*/

require('dotenv').config();
var express = require('express');
var serveStatic = require('serve-static');
var app = require('./controller/app.js');

var port = process.env.PORT || 8081;

app.use(serveStatic(__dirname + '/public')); 

var server = app.listen(port, function(){
    console.log('Web App Hosted at http://localhost:%s', port);
});