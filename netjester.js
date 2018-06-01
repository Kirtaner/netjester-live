const _ = require('./public/js/lodash');
const request = require('request');

NetjesterServer = (io, config) => {
    lastResponse = '';
    clientConfig = {
        "Voice": config.get('Voice'),
        "Netjester": config.get('Netjester'),
        "Debug": config.get('Server.debug')
    };

    apiRandomReply = client => {
        let random = null;
        
        request.get({
            url: 'https://api.420chan.org/netjester/random.json',
            json: true,
            headers: {'User-Agent': 'Netjester Live'}
        }, (err, res, data) => {
            if (err) {
                console.log('Random Reply Error:', err);
            } else if (res.statusCode !== 200) {
                console.log('Random Reply Erroneous Status:', res.statusCode);
            } else {
                sendNextResponse(client, data);
            }
        });

        return random;
    };

    // Basically just forwards the 420chan Netjester API response to the browser client for TTS
    // Twitch chat -> Phantombot -> 420chan API -> Netjester AI daemon -> back to Phantombot -> Here/channel
    sendNextResponse = (client, reply) => {
        if (reply.offline) {
            client.emit('offline', 1);
        } else {
            client.emit('talk', reply.text);
        }
    };

    let throttledNextResponse = _.throttle(apiRandomReply, 6000);

    pollChatResponse = () => {
    };

    systemSpeechFallback = () => {
    };

    connectClient = client => {
        client.emit('connected', clientConfig);

        client.on('disconnect', () => { disconnectClient(client) });
        client.on('finishedTalking', () => { throttledNextResponse(client) });
        client.on('fallbackToSystemSpeech', () => { systemSpeechFallback() });

        console.log("Clients connected: %d", io.engine.clientsCount);
    };

    disconnectClient = client => {
        console.log('Client disconnected');
    };

    io.on('connection', connectClient);
};

module.exports = NetjesterServer;