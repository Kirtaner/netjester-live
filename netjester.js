module.exports = function(io, config) {
    let Connected = {},
        lastResponse = '',
        clientConfig = {
            "Voice": config.get('Voice'),
            "Netjester": config.get('Netjester'),
            "Debug": config.get('Server.debug')
        };

    // espeak, festival, flite, freetts, mimic

    Netjester = {
        initializeClient(client) {
            client.emit('connected', clientConfig);
        },

        // Basically just forwards the 420chan Netjester API response to the browser client for TTS
        // Twitch chat -> Phantombot -> 420chan API -> Netjester AI daemon -> back to Phantombot -> Here/channel
        sendNextResponse() {
            // io.emit()
        },

        pollChatResponse() {

        },

        systemSpeechFallback() {
            
        }
    };

    // Realistically only one connection will ever be alive at a time, at least in this incarnation
    // Still have to handle graceful termination and all that crap tho
    io.on('connection', function (client) {
        Connected[client.id] = client;
        console.log("Clients connected: %d", Object.keys(Connected).length);

        Netjester.initializeClient(client);

        client.on('disconnect', function() {
            delete Connected[client.id];
            console.log('Client disconnected');
        });

        client.on('finishedTalking', function(response) {
            // give a bit of thought to voice queueing and rate limiting
        });

        // Use node server and local system processes if wanted/needed
        client.on('fallbackToSystemSpeech', Netjester.systemSpeechFallback);
    });
};