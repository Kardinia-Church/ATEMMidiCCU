const {Atem} = require("atem-connection");
var midi = require("midi");
var midiInput = {
    "port": new midi.Input(),
    "name": "",
    "connection": false
};
var midiOutput = {
    "port": new midi.Output(),
    "name": "",
    "connection": false
};

var nconf = require("nconf");
var atemIP = undefined;
const atem = new Atem();

//Attempt to load in the configuration
function loadConfig(callback) {
    nconf.use("file", {file: "./config.json"});
    nconf.load();

    var error = false;
    if(nconf.get("atemIP") === undefined) {nconf.set("atemIP", "127.0.0.1"); error = true;}
    if(nconf.get("midiInputDevice") === undefined || nconf.get("midiInputDevice") == "") {nconf.set("midiInputDevice", ""); error = true;}
    if(nconf.get("midiOutputDevice") === undefined || nconf.get("midiInputDevice") == "") {nconf.set("midiOutputDevice", ""); error = true;}

    if(error) {
        //Error
        console.log("There is an issue with the configuration file. Please check the configuration file config.json");
        console.log("\nMidi input devices:");
        for(var i = 0; i < midiInput.port.getPortCount(); i++) {
            console.log(midiInput.port.getPortName(i));
        }

        console.log("Midi output devices:");
        for(var i = 0; i < midiOutput.port.getPortCount(); i++) {
            console.log(midiOutput.port.getPortName(i));
        }
        
        nconf.save(function (error) {
            if(error){console.log("An error occurred saving the config file: " + error.message);}
            callback(false);
        });
    }
    else {
        //Load in the settings
        atemIP = nconf.get("atemIP");

        //Find the midi ios and set them
        var error = true;
        midiInput.name = nconf.get("midiInputDevice");
        for(var i = 0; i < midiInput.port.getPortCount(); i++){if(midiInput.port.getPortName(i) == nconf.get("midiInputDevice")){midiInput.port.openPort(i); error = false; break;}}
        if(error){console.log("Failed to find the midi input " + nconf.get("midiInputDevice")); callback(false);} error = true;
        midiOutput.name = nconf.get("midiOutputDevice");
        for(var i = 0; i < midiOutput.port.getPortCount(); i++){if(midiOutput.port.getPortName(i) == nconf.get("midiOutputDevice")){midiOutput.port.openPort(i); error = false; break;}}
        if(error){console.log("Failed to find the midi output " + nconf.get("midiInputDevice")); callback(false);} error = true;

        callback(true);
    }
}

//Connect to the ATEM
function connect() {
    //Set the handlers
    atem.on("info", function(message) {
        console.log("INFO: " + message);
    });
    atem.on("error", function(error) {
        console.log("ERROR: " + error);
    });

    atem.on("connected", () => {
        console.log("Successfully connected to the ATEM");
    });
    atem.on("disconnected", function() {
        console.log("Disconnected from the ATEM");
    });
    atem.on('stateChanged', (state, pathToChange) => {
    });

    //Connect
    atem.connect(atemIP);
}

//Main loop
console.log("ATEM MIDI Switcher by Kardinia Church 2021");
console.log("Attempting to load configuration");

loadConfig(function(success) {
    if(success == true) {
        //Add a process to check if midi is connected
        setInterval(function() {
            //Input
            var found = false;
            var portId = 0;

            //Find input
            for(var i = 0; i < midiInput.port.getPortCount(); i++) {
                if(midiInput.port.getPortName(i) == midiInput.name) {found = true; portId = i; break;}
            }
            if(found == false) {
                console.log("Lost connection to the midi input device " + midiInput.name);
                midiInput.connection = true;
                midiInput.port.closePort();
            }
            else if(midiInput.connection == true) {
                console.log("Regained the midi input device " + midiInput.name);
                midiInput.port.openPort(portId);
                midiInput.connection = false;
            }

            //Output
            found = false;
            portId = 0;
            for(var i = 0; i < midiOutput.port.getPortCount(); i++) {
                if(midiOutput.port.getPortName(i) == midiOutput.name) {found = true; portId = i; break;}
            }
            if(found == false) {
                console.log("Lost connection to the midi output device " + midiOutput.name);
                midiOutput.connection = true;
                midiOutput.port.closePort();
            }
            else if(midiOutput.connection == true) {
                console.log("Regained the midi output device " + midiOutput.name);
                midiOutput.port.openPort(portId);
                midiOutput.connection = false;
            }
        }, 1000);


        //Everything seems good lets begin!
        console.log("Success, attempting connection to the ATEM at " + atemIP);
        connect();

        //Add the callbacks for MIDI
        midiInput.port.on("message", function (deltaTime, message) {
            console.log(`m: ${message} d: ${deltaTime}`);
        });
    }
    else {
        console.error("Initialization errors occurred, will retry in 15 seconds");
        setTimeout(function(){main();}, 15000);
    }
});