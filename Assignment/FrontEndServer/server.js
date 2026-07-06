/*
Summary: The server.js is used to start the frontend server with HTTPS.
*/

const express = require('express');
const serveStatic = require('serve-static');
const https = require('https');
const fs = require('fs');

var hostname = "localhost";
var port = 3001;


var app = express();


// Only allow GET requests
app.use(function(req,res,next){

    console.log(req.url);
    console.log(req.method);
    console.log(req.path);
    console.log(req.query.id);


    if(req.method != "GET"){

        res.type('.html');

        var msg =
        "<html><body>This server only serves web pages with GET!</body></html>";

        res.end(msg);

    }else{

        next();

    }

});


// Serve frontend files
app.use(
    serveStatic(__dirname + "/public")
);


// TLS certificate
var options = {

    key: fs.readFileSync(
        './certs/localhost-key.pem'
    ),

    cert: fs.readFileSync(
        './certs/localhost.pem'
    )

};


// HTTPS frontend server
https.createServer(
    options,
    app
)
.listen(port, hostname, function(){

    console.log(
    `Frontend hosted at https://${hostname}:${port}`
    );

});