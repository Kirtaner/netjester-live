let socket = io(),
    connected = false,
    config = null,
    Netjester = {
        audioDisabled: false,
        speakingTimer: null,
        isSpeaking: false,
        availableVoices: null
    };

socket.on('connected', function(msg) {
    Netjester.init(msg);
});

Netjester.init = function(msg) {
    config = msg;

    // This is a full reload so set up audio devices and do DOMshit
    if(!connected) {
        Netjester.initializeSpeech();
        Netjester.initializeAudioInput();

        // Reveal the thing
        $('#loading').remove();
        $('#netjester').removeClass('hidden');

        connected = true;
        Netjester.log('Init', 'Ready to blab!', 1);
    } else {
        // Basically keep going where we left off
        Netjester.log('Init', 'I LIVED BITCH', 1);
    }
}

Netjester.initializeSpeech = function() {
    let voices = speechSynthesis.getVoices();

    if (!Array.isArray(voices) || !voices.length) {
        Netjester.log('SpeechSynthesis', 'Waiting for voices, hooking onvoiceschanged...');

        speechSynthesis.onvoiceschanged = function() {
            Netjester.initializeSpeech();
        }
    } else {
        Netjester.log('SpeechSynthesis', 'Loaded voices');

        speechSynthesis.onvoiceschanged = null;
        this.availableVoices = voices;
    }
}

// Check for WebAudio input sources for generating extra visuals
Netjester.initializeAudioInput = function() {
    this.audioContext = new AudioContext();

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

    let audioStream =
        Netjester.audioContext.createMediaStreamSource(stream),
        audioAnalyser =
        Netjester.audioContext.createAnalyser();

    audioAnalyser.smoothingTimeConstant = 0.3;
    audioAnalyser.fftSize = 1024;

    let volumeMonitor =
        Netjester.audioContext.createScriptProcessor(2048, 1, 1);

    volumeMonitor.onaudioprocess = function () {
        let array =
            new Uint8Array(audioAnalyser.frequencyBinCount);

        audioAnalyser.getByteFrequencyData(array);

        let average =
            Netjester.getAverageVolume(array);

        Netjester.log('Volume Meter', 'VOLUME: ' + average);
    }

    audioStream.connect(audioAnalyser);

    this.audioStream = audioStream,
        this.audioAnalyser = audioAnalyser,
        this.volumeMonitor = volumeMonitor;

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

Netjester.saySomething = function(input) {
    let msg = new SpeechSynthesisUtterance(input),
        params = config.Voice.chrome;

    // msg.voice = this.availableVoices[1];
    msg.lang = 'en-US';
    // msg.voiceURI = 'native';
    msg.volume = 1; // 0 to 1
    msg.rate = params.speed; // 0.1 to 10
    msg.pitch = params.pitch; //0 to 2
    // msg.text = input;

    Netjester.speak(msg);
}

// Chrome has a weird quirk where every 15 seconds of nonstop speech the TTS engine halts without warnings or events firing
// Behold this hackish workaround - constant timed pause/resumes that are microseconds long
Netjester.speak = function(msg) {
    let speechTimer = this.speakingTimer;
    let isSpeaking = this.isSpeaking;
    let fragment = 1;

    if (!isSpeaking) {
        // Unsticks the voice if something weird happens
        speechSynthesis.cancel();

        if (speechTimer) {
            clearInterval(speechTimer);
        }

        msg.onboundary = function(e) {
            Netjester.log('SpeechSynthesisUtterance', 'word boundary at ' + e.elapsedTime);
            if (e.elapsedTime > 13000 * fragment) {
                speechSynthesis.pause();
                fragment++;
            }
        };
    
        msg.onerror = function(e) {
            Netjester.log('SpeechSynthesisUtterance', e.error);
            speechSynthesis.cancel();
            isSpeaking = false;
            clearInterval(speechTimer);
        };

        msg.onpause = function(e) {
            Netjester.log('SpeechSynthesisUtterance', 'paused at ' + e.elapsedTime);
        }

        msg.onend = function(e) {
            Netjester.log('SpeechSynthesisUtterance', 'ended at ' + e.elapsedTime);
            speechSynthesis.cancel();
            isSpeaking = false;
            clearInterval(speechTimer);
            socket.emit('finishedTalking', 1);
        };

        speechSynthesis.speak(msg);

        isSpeaking = true;

        speechTimer = setInterval(function(){
            if (speechSynthesis.paused) {
                Netjester.log('SpeechSynthesis','resume speech');
                speechSynthesis.resume();
            }
        }, 100);
    }
}

Netjester.log = function(eventName, eventText, forceLog) {
    if (config.Debug || forceLog) {
        console.log(eventName, '-', eventText);
    }
}