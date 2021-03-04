const {Atem, AtemStateUtil} = require("atem-connection");
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
var keyFlasher = [undefined, false];

var buttons = [[8, 16, 24, 32], [9, 17, 25, 33], [10, 18, 26, 34], [11, 19, 27, 35], [12, 20, 28, 36], [13, 21, 29, 37], [14, 22, 30, 38], [15, 23, 31, 39]];
var faders = [70, 71, 72, 73, 74, 75, 76, 77];
var levels = [90, 91, 92, 93, 94, 95, 96, 97];
var knobs = [80, 81, 82, 83, 84, 85, 86, 87];
var knobButtons = [0, 1, 2, 3, 4, 5, 6, 7];
var lcdColors = {
    "black": 0,
    "red": 1,
    "green": 2,
    "yellow": 3,
    "blue": 4,
    "magenta": 5,
    "cyan": 6,
    "white": 7
};

//Start flashing the keys to show connection issues
function flashKeys() {
    keyFlasher[0] = setInterval(function() {
        for(var i = 0; i < buttons.length; i++){for(var j = 0; j < buttons[i].length; j++){setButtonBacklight(i, j, keyFlasher[1]);}}
        keyFlasher[1] = !keyFlasher[1];
    }, 500);
}

//Stop flashing the keys
function stopFlashKeys() {
    clearInterval(keyFlasher[0]);
    keyFlasher[1] = false;
    update();
}

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
        update();
        stopFlashKeys();
    });
    atem.on("disconnected", function() {
        console.log("Disconnected from the ATEM");
        flashKeys();
    });
    atem.on('stateChanged', (state, pathToChange) => {
        update();
        console.log(pathToChange);
    });

    //Connect
    atem.connect(atemIP);
}

function setButtonBacklight(bank, button, state) {
    midiOutput.port.sendMessage([144, buttons[bank][button], state ? 127 : 0]);
}

function setLevel(bank, value) {
    midiOutput.port.sendMessage([176, levels[bank], value]);
}

function setFader(bank, value) {
    midiOutput.port.sendMessage([176, faders[bank], value]);
}

function setKnobPosition(bank, value) {
    midiOutput.port.sendMessage([176, knobs[bank], value]);
}

//Currently not working :(
function setScreenText(bank, color, value) {
    var color = lcdColors[color].toString(2);
    var invertUpper = "0";
    var invertLower = "0";
    var bits = color + "0" + invertUpper + invertLower; bits = bits.split("").reverse().join("");
    //var buffer = [0xF0, 0x00, 0x20, 0x32, 0x42, 0x4C, bank, parseInt(color + invertUpper + "0" + invertLower, 2).toString(16).toUpperCase()];
    console.log(bits);
    buffer = Buffer.concat([Buffer.from([0xF0, 0x00, 0x20, 0x32, 0x42, 0x4C, bank, parseInt(bits, 2)]), Buffer.from(value), Buffer.from([0xF7])]);
    console.log(buffer);
    midiOutput.port.sendMessage(Array.prototype.slice.call(buffer, 0));
}

function handleButtons(rawButton) {
    for(var i = 0; i < buttons.length; i++) {
        switch(rawButton) {
            case buttons[i][0]: {
                setButtonBacklight(i, 0, true);
                break;
            }
            case buttons[i][1]: {
                setButtonBacklight(i, 1, true);
                break;
            }
            case buttons[i][2]: {
                setButtonBacklight(i, 2, true);
                break;
            }
            case buttons[i][3]: {
                setButtonBacklight(i, 3, true);
                break;
            }
        }
    }
}

//Update the status of the device
function update() {
    //console.log(atem.state);








}

//Main loop
console.log("ATEM MIDI CCU by Kardinia Church 2021");
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
                update();
            }
        }, 1000);

        //Reset
        for(var i = 0; i < buttons.length; i++){for(var j = 0; j < buttons[i].length; j++){setButtonBacklight(i, j, false);}}
        for(var i = 0; i < faders.length; i++){setFader(i, 0);}
        for(var i = 0; i < knobs.length; i++){setKnobPosition(i, 0);}
        for(var i = 0; i < levels.length; i++){setLevel(i, 0);}
        flashKeys();

        //Everything seems good lets begin!
        console.log("Success, attempting connection to the ATEM at " + atemIP);
        connect();

        //Add the callbacks for MIDI
        midiInput.port.on("message", function (deltaTime, message) {
            console.log(`m: ${message} d: ${deltaTime}`);

            switch(message[0]) {
                //Button
                case 144: {
                    if(message[2] == 127) {
                        handleButtons(message[1]);

                    }
                    break;
                }
                //Fader, Knob
                case 176: {
                    console.log("FADER " + message[1]);
                    break;
                }
            }














        });
    }
    else {
        console.error("Initialization errors occurred, will retry in 15 seconds");
        setTimeout(function(){main();}, 15000);
    }
});