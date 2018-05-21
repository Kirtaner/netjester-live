// NPM Modules
const path = require('path');
const fs = require('fs');
const express = require('express');
const logger = require('morgan');
const dotenv = require('dotenv');

// Load api keys and active configuration set
dotenv.load();
const config = require('config');
const host = config.get('Server.address') || '0.0.0.0';
const port = config.get('Server.port') || 3000;

// Bind express and Socket.IO
const app = express();
const server = require('http').createServer(app);
const sio = require('socket.io').listen(server);

// Here be the client library that will someday enslave us all
const netjester = require('./netjester')(sio, config);

// Content and routes
app.use(express.static(path.join(__dirname, 'public')));

app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, '/netjester.html'));
});

server.listen(port, function () {
    console.log('Netjester TTS show host started on port ' + port);
});

module.exports = app;