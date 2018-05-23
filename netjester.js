NetjesterServer = (io, config) => {
    lastResponse = '';
    clientConfig = {
        "Voice": config.get('Voice'),
        "Netjester": config.get('Netjester'),
        "Debug": config.get('Server.debug')
    };

    // Basically just forwards the 420chan Netjester API response to the browser client for TTS
    // Twitch chat -> Phantombot -> 420chan API -> Netjester AI daemon -> back to Phantombot -> Here/channel
    sendNextResponse = () => {
    };

    pollChatResponse = () => {
    };

    systemSpeechFallback = () => {
    };

    connectClient = (client) => {
        client.emit('connected', clientConfig);

        client.on('disconnect', disconnectClient);
        client.on('finishedTalking', sendNextResponse);
        client.on('fallbackToSystemSpeech', systemSpeechFallback);

        console.log("Clients connected: %d", io.engine.clientsCount);
    };

    disconnectClient = (client) => {
        console.log('Client disconnected');
    };

    io.on('connection', connectClient);
};

module.exports = NetjesterServer;