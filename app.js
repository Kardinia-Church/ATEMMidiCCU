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
var selectedCamera = 1;
var ccuAux = 1;
var me = 0;

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
    var self = this;

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

        atem.on('stateChanged', (state, pathToChange) => {
            update();
        });      

        console.log(atem.state.cameras);
    });
    atem.on("disconnected", function() {
        console.log("Disconnected from the ATEM");
        flashKeys();
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

function handleButtons(rawButton, value) {
    //Top buttons
    for(var i = 0; i < buttons.length; i++) {
        if(rawButton == buttons[i][3]) {
            atem.setAuxSource(i + 1, ccuAux);
            break;
        }
    }

    //Knob buttons
    for(var i = 0; i < knobButtons.length; i++) {
        if(rawButton == knobButtons[i]) {
            //Reset the features when clicked to 0
            var rgby = atem.state.cameras[i + 1].liftRGBY;
            atem.setAuxSource(i + 1, ccuAux);
            atem.setCameraLiftRGBY(i + 1, rgby[0], rgby[1], rgby[2], 0);
        }
    }
}

function handleFaders(fader, value) {
    for(var i = 0; i < faders.length; i++) {
        if(fader == faders[i]) {
            atem.setAuxSource(i + 1, ccuAux);
            atem.setCameraIris(i + 1, (value / 127));
        }
    }
}

function handleKnobs(knob, value) {
    for(var i = 0; i < knobs.length; i++) {
        if(knob == knobs[i]) {
            //At the moment we only set the lift to all 8 faders where fader number = camera number
            var set = false;
            var rgby = atem.state.cameras[i + 1].liftRGBY;
            if(value == 1) { rgby[3] -= 0.01;} else {rgby[3] += 0.01;}

            //Ok set it
            if(value == 1 || value == 65) {
                atem.setAuxSource(i + 1, ccuAux);
                atem.setCameraLiftRGBY(i + 1, rgby[0], rgby[1], rgby[2], rgby[3]);
            }
        }
    }
}

//Update the status of the device
function update() {
    //Update the iris fader
    for(var fader in faders) {
        if(atem.state.cameras[parseInt(fader) + 1] !== undefined) {
            setFader(fader, atem.state.cameras[parseInt(fader) + 1].iris * 127);
        }
        else {
            setFader(fader, 0);
        }
    }

    //Set the selected camera
    selectedCamera = parseInt(atem.state.video.auxilliaries[ccuAux]);
    for(var j = 0; j < buttons.length; j++) {
        if(selectedCamera - 1 == j) {
            setButtonBacklight(j, 3, true);
        }
        else {
            setButtonBacklight(j, 3, false);
        }
    }
    for(var j = 0; j < buttons.length; j++) {
        if(atem.state.video.mixEffects[me].programInput - 1 == j) {
            setButtonBacklight(j, 0, true);
        }
        else {
            setButtonBacklight(j, 0, false);
        }
    }

    //Set the knob indiction according to the selected camera
    setKnobPosition((selectedCamera - 1) + 0, (atem.state.cameras[selectedCamera].liftRGBY[3] + 1.0) * 63.5);
    setKnobPosition((selectedCamera - 1) + 1, (atem.state.cameras[selectedCamera].liftRGBY[0] + 1.0) * 63.5);
    setKnobPosition((selectedCamera - 1) + 2, (atem.state.cameras[selectedCamera].liftRGBY[1] + 1.0) * 63.5);
    setKnobPosition((selectedCamera - 1) + 3, (atem.state.cameras[selectedCamera].liftRGBY[2] + 1.0) * 63.5);
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
                    handleFaders(message[1], message[2]);
                    handleKnobs(message[1], message[2]);
                    break;
                }
            }
        });
    }
    else {
        console.error("Initialization errors occurred, cannot continue");
    }
});