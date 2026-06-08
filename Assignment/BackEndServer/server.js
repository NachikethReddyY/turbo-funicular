/*


Summary: The server.js is used to start the backend server.
*/

require('dotenv').config();
var express = require('express');
var serveStatic = require('serve-static');
var app = require('./controller/app.js');

var port = process.env.PORT || 8081;

app.use(serveStatic(__dirname + '/public'));
app.use(serveStatic(__dirname + '/../FrontEndServer/Public'));

var server = app.listen(port, function(){
    console.log('Running on http://localhost:%s', port);
});