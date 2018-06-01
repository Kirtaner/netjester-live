let socket = io(),
    connected = false,
    config = null,
    Netjester = {
        audioDisabled: false,
        isSpeaking: false,
        availableVoices: [],
        usingLocalSynthesiser: false
    };

socket.on('connected', function(msg) {
    Netjester.init(msg);

    socket.on('talk', function(msg) { 
        Netjester.gotSomethingToSay(msg);
    });

    socket.on('offline', function(dead) {
        if (dead) {
            Netjester.apiOffline();
        }
    });
});

Netjester.init = function(msg) {
    config = msg;

    // This is a full reload so set up audio devices and do DOMshit
    if(!connected) {
        if(config.Voice.useLocalSynthesiser) {
            Netjester.initializeSystemSpeech();
        } else {
            Netjester.initializeSpeech();
            Netjester.voicesChangedHandler();
        }

        Netjester.initializeAudioInput();

        // Reveal the thing
        $('#loading').remove();
        $('#main').removeClass('hidden');

        connected = true;
        Netjester.log('Init', 'Ready to blab!', 1);
    } else {
        // Basically keep going where we left off
        Netjester.log('Init', 'I LIVED BITCH', 1);
    }
}

Netjester.initializeSystemSpeech = function() {
    Netjester.log('System Speech', 'Using system speech with daemon "' + config.Voice.local.daemon + '"', 1);
    this.availableVoices = config.Voice.local.voices;
    this.usingLocalSynthesiser = true;
}

Netjester.initializeSpeech = function() {
    let voices = window.speechSynthesis.getVoices();

    if (!Array.isArray(voices) || !voices.length) {
        Netjester.log('SpeechSynthesis', 'Still waiting for voices...', 1);
    } else {
        if (voices.length > Netjester.availableVoices.length) {
            Netjester.log('SpeechSynthesis', voices.length + ' voices now available', 1);
        }
        Netjester.availableVoices = voices;
    }
}

Netjester.voicesChangedHandler = function() {
    window.speechSynthesis.onvoiceschanged = _.debounce(Netjester.initializeSpeech, 300);
}

// Check for WebAudio input sources for generating extra visuals
Netjester.initializeAudioInput = function() {
    Netjester.audioContext = new AudioContext();

    try {
        navigator.getUserMedia({
            "audio": {
                "mandatory": {
                    "googEchoCancellation": 0,
                    "googAutoGainControl": 0,
                    "googNoiseSuppression": 0,
                    "googHighpassFilter": 0,
                },
                "optional": []
            },
        }, this.gotAudio, this.noAudio);
    } catch (e) {
        Netjester.log('Audio Input', 'getUserMedia exception: ' + e, 1);
    }
}

Netjester.noAudio = function(e) {
    this.audioDisabled = true;

    Netjester.log('Audio Input', 'Failed to initialize AudioContext: ' + e, 1);
}

Netjester.gotAudio = function(stream) {
    window.persistAudioStream = stream;

    Netjester.audioStream = Netjester.audioContext.createMediaStreamSource(stream);
    Netjester.audioAnalyser = Netjester.audioContext.createAnalyser();

    Netjester.audioAnalyser.smoothingTimeConstant = 0.3;
    Netjester.audioAnalyser.fftSize = 1024;

    Netjester.volumeMonitor = Netjester.audioContext.createScriptProcessor(2048, 1, 1);

    Netjester.volumeMonitor.onaudioprocess = function () {
        let array =
            new Uint8Array(Netjester.audioAnalyser.frequencyBinCount);

        Netjester.audioAnalyser.getByteFrequencyData(array);

        let average =
            Netjester.getAverageVolume(array);

        Netjester.log('Volume Meter', 'VOLUME: ' + average);
    }

    Netjester.audioStream.connect(Netjester.audioAnalyser);

    Netjester.log('Audio Input', 'initialized', 1);
}

Netjester.getAverageVolume = function(audio) {
    let values = 0,
        average;

    let frequencyCount = audio.length;

    for (var i = 0; i < frequencyCount; i++) {
        values += audio[i];
    }

    average = values / frequencyCount;
    return average;
}

// API status handlers, pause normal activity and send periodic heartbeats until it's alive again
// Sometimes you gotta work on the brain and stuff, and its an external API endpoint
// Also this is a bit dirty but that's fine I'll make it better later
Netjester.apiOffline = function() {
    $('#netjester-output').text('MALFUNCTION :: BRAIN CURRENTLY MISSING :: SEARCHING');

    setTimeout(function(){
        socket.emit('finishedTalking', 1);
    }, 30000);
}

Netjester.saySomething = function(input) {
    if (this.usingLocalSynthesiser) {
        Netjester.systemSpeak(input);
    } else {
        Netjester.speak(input);
    }
}

Netjester.gotSomethingToSay = function(input) {
    this.saySomething(input);
}

Netjester.systemSpeak = function(input) {
    socket.emit('speak', input);
}

// Chrome has a weird quirk where every 15 seconds of nonstop speech the TTS engine halts without warnings or events firing
// Behold this hackish workaround - constant timed pause/resumes that are microseconds long
Netjester.speak = function(input) {
    let params = {};

    // this needs to be a bit more elegant and also not just set at runtime
    if (config.Voice.randomPitchSpeed) {
        params.rate = this.randomDecimal(1.5);
        params.pitch = this.randomDecimal(2);
        Netjester.log('SpeechSynthesis', 'Using randomized rate: ' + params.rate + ', pitch: ' + params.pitch);
    } else {
        params.rate = config.Voice.rate;
        params.pitch = config.Voice.pitch;
    }

    if (!Netjester.isSpeaking) {
        // Unsticks the voice if something weird happens
        speechSynthesis.cancel();

        if (Netjester.speechTimer) {
            clearInterval(Netjester.speechTimer);
        }

        let msg = new SpeechSynthesisUtterance();

        let randomVoice = Netjester.randomIntegerBetween(1, 3);
        msg.voice = this.availableVoices[randomVoice];
        msg.lang = 'en-US'; // fallback
        msg.volume = 1; // 0 to 1
        msg.rate = params.rate; // 0.1 to 10
        msg.pitch = params.pitch; //0 to 2
        msg.text = input;

        msg.onstart = function(e) {
            Netjester.log('SpeechSynthesisUtterance', 'started speaking');
        }

        // msg.onboundary = function(e) {
        //     Netjester.log('SpeechSynthesisUtterance', 'word boundary at ' + e.elapsedTime);
        //     if (e.elapsedTime > 13000 * Netjester.speechFragments) {
        //         speechSynthesis.pause();
        //         Netjester.speechFragments++;
        //     }
        // };

        msg.onerror = function(e) {
            Netjester.log('SpeechSynthesisUtterance', e.error);
            // speechSynthesis.cancel();
            Netjester.isSpeaking = false;
            clearInterval(Netjester.speechTimer);
        };

        // msg.onpause = function(e) {
        //     Netjester.log('SpeechSynthesisUtterance', 'paused at ' + e.elapsedTime);
        // }

        msg.onend = function(e) {
            Netjester.log('SpeechSynthesisUtterance', 'ended at ' + e.elapsedTime);
            speechSynthesis.cancel();
            Netjester.isSpeaking = false;
            clearInterval(Netjester.speechTimer);
            socket.emit('finishedTalking', 1);
        };

        speechSynthesis.speak(msg);

        $('#netjester-output').text(input);

        Netjester.isSpeaking = true;

        // Netjester.speechTimer = setInterval(function(){
        //     if (speechSynthesis.paused) {
        //         Netjester.log('SpeechSynthesis','resume speech');
        //         speechSynthesis.resume();
        //     }
        // }, 100);

        Netjester.speechTimer = setInterval(function(){
            if(speechSynthesis.speaking) {
                Netjester.log('SpeechSynthesis', 'kicking it so it keeps talking');
                speechSynthesis.resume();
            } else {
                Netjester.isSpeaking = false;
                speechSynthesis.cancel();
                clearInterval(Netjester.speechTimer);
                socket.emit('finishedTalking', 1);
            }
        }, 13000);

    }
}

// ONE DAY JAVASCRIPT WILL HAVE A GOOD NATIVE RANDOM NUMBER FACILITY
// BUT TODAY IS NOT THAT DAY
Netjester.randomInteger = function(max) {
    let integer = Math.floor(Math.random() * max);
    return integer;
}

Netjester.randomIntegerBetween = function(min, max) {
    let integer = Math.floor(Math.random() * (max - min + 1)) + min;
    return integer;
}

// ok like Math.random was designed by someone that looked at binary and thought "yeah good enough just add a decimal"
// seriously though what the fucking fuck
// "yeah we need a random number so we'll just make it between 0 and 1 and let god sort it out"
Netjester.randomDecimal = function(max) {
    let decimal = Math.min(((Math.random() * max) + 0.1).toFixed(1), (max - 0.1));
    return decimal;
}

Netjester.log = function(eventName, eventText, forceLog) {
    if (config.Debug || forceLog) {
        console.log(eventName, '-', eventText);
    }
}