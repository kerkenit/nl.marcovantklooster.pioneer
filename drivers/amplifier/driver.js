var net = require('net');
// Temporarily store the device's IP address and name. For later use, it gets added to the device's settings
var tempIP = '';
var tempDeviceName = '';
// Variable to hold responses from the AVR
var receivedData = "";
// The Pioneer IP network interface uses port 8102 as telnet port
var telnetPort = 8102;
// a list of devices, with their 'id' as key
// it is generally advisable to keep a list of
// paired and active devices in your driver's memory.
var devices = {};
var allPossibleInputs = [{
	inputName: "25FN\r",
	friendlyName: "BD"
}, {
	inputName: "04FN\r",
	friendlyName: "DVD"
}, {
	inputName: "15FN\r",
	friendlyName: "DVR/BDR"
}, {
	inputName: "06FN\r",
	friendlyName: "SAT/CBL"
}, {
	inputName: "FN49\r",
	friendlyName: "GAME"
}, {
	inputName: "01FN\r",
	friendlyName: "CD"
}, {
	inputName: "05FN\r",
	friendlyName: "TV"
}, {
	inputName: "02FN\r",
	friendlyName: "Tuner"
}, {
	inputName: "38FN\r",
	friendlyName: "Internet Radio"
}, {
	inputName: "45FN\r",
	friendlyName: "Favorites"
}, {
	inputName: "17FN\r",
	friendlyName: "iPod/USB"
}, {
	inputName: "10FN\r",
	friendlyName: "VIDEO 1"
}, {
	inputName: "14FN\r",
	friendlyName: "VIDEO 2"
}, {
	inputName: "19FN\r",
	friendlyName: "HDMI1"
}, {
	inputName: "20FN\r",
	friendlyName: "HDMI2"
}, {
	inputName: "21FN\r",
	friendlyName: "HDMI3"
}, {
	inputName: "22FN\r",
	friendlyName: "HDMI4"
}, {
	inputName: "23FN\r",
	friendlyName: "HDMI5"
}, {
	inputName: "24FN\r",
	friendlyName: "HDMI6"
}, {
	inputName: "48FN\r",
	friendlyName: "MHL"
}, {
	inputName: "03FN\r",
	friendlyName: "CD-R/TAPE"
}, {
	inputName: "00FN\r",
	friendlyName: "PHONO"
}];
// init gets run at the time the app is loaded. We get the already added devices then need to run the callback when done.
module.exports.init = function(devices_data, callback) {
	devices_data.forEach(function(device_data) {
		Homey.log('Pioneer app - init device: ' + JSON.stringify(device_data));
		initDevice(device_data);
	});
	//tell Homey we're happy to go
	callback();
};
// start of pairing functions
module.exports.pair = function(socket) {
	// socket is a direct channel to the front-end
	// this method is run when Homey.emit('list_devices') is run on the front-end
	// which happens when you use the template `list_devices`
	socket.on('list_devices', function(data, callback) {
		Homey.log("Pioneer app - list_devices data: " + JSON.stringify(data));
		// tempIP and tempDeviceName we got from when get_devices was run (hopefully?)
		var newDevices = [{
			data: {
				id: tempIP,
			},
			name: tempDeviceName,
			settings: {
				"settingIPAddress": tempIP
			} // initial settings
		}];
		callback(null, newDevices);
	});
	// this is called when the user presses save settings button in start.html
	socket.on('get_devices', function(data, callback) {
		// Set passed pair settings in variables
		tempIP = data.ipaddress;
		tempDeviceName = data.deviceName;
		Homey.log("Pioneer app - got get_devices from front-end, tempIP =", tempIP, " tempDeviceName = ", tempDeviceName);
		// FIXME: should check if IP leads to an actual Pioneer device
		// assume IP is OK and continue, which will cause the front-end to run list_amplifiers which is the template list_devices
		socket.emit('continue', null);
	});
	socket.on('disconnect', function() {
		console.log("Pioneer app - Pairing is finished (done or aborted)");
	});
};
// end pair
module.exports.added = function(device_data, callback) {
	// run when a device has been added by the user (as of v0.8.33)
	Homey.log("Pioneer app - device added: " + JSON.stringify(device_data));
	// update devices data array
	initDevice(device_data);
	Homey.log('Pioneer app - add done. devices =' + JSON.stringify(devices));
	callback(null, true);
};
module.exports.renamed = function(device_data, new_name) {
	// run when the user has renamed the device in Homey.
	// It is recommended to synchronize a device's name, so the user is not confused
	// when it uses another remote to control that device (e.g. the manufacturer's app).
	Homey.log("Pioneer app - device renamed: " + JSON.stringify(device_data) + " new name: " + new_name);
	// update the devices array we keep
	devices[device_data.id].data.name = new_name;
};
module.exports.deleted = function(device_data) {
	// run when the user has deleted the device from Homey
	Homey.log("Pioneer app - device deleted: " + JSON.stringify(device_data));
	// remove from the devices array we keep
	delete devices[device_data.id];
};
// handling settings (wrench icon in devices)
module.exports.settings = function(device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
	// run when the user has changed the device's settings in Homey.
	// changedKeysArr contains an array of keys that have been changed, for your convenience :)
	// always fire the callback, or the settings won't change!
	// if the settings must not be saved for whatever reason:
	// callback( "Your error message", null );
	// else callback( null, true );
	Homey.log('Pioneer app - Settings were changed: ' + JSON.stringify(device_data) + ' / ' + JSON.stringify(newSettingsObj) + ' / old = ' + JSON.stringify(oldSettingsObj) + ' / changedKeysArr = ' + JSON.stringify(changedKeysArr));
	try {
		changedKeysArr.forEach(function(key) {
			switch (key) {
			case 'settingIPAddress':
				Homey.log('Pioneer app - IP address changed to ' + newSettingsObj.settingIPAddress);
				// FIXME: check if IP is valid, otherwise return callback with an error
				break;
			}
		});
		callback(null, true);
	} catch (error) {
		callback(error);
	}
};
// capabilities
module.exports.capabilities = {
	onoff: {
		get: function(device_data, callbackCapability) {
			Homey.log("Pioneer app - getting device on/off status of " + device_data.id);
			//QUERY POWER STATUS
			sendCommandToDevice(device_data, '?P\r', function(receivedData) {
				Homey.log("Pioneer app - got callback, receivedData: " + receivedData);
				// if the response contained "PWR0", the AVR was on. Else it was probably in standby.
				if (receivedData.indexOf("PWR0") >= 0) {
					Homey.log("Pioneer app - telling capability power is on");
					callbackCapability(null, true);
				} else {
					Homey.log("Pioneer app - telling capability power is off");
					callbackCapability(null, false);
				}
			});
		},
		set: function(device_data, turnon, callbackCapability) {
			Homey.log('Pioneer app - Setting device_status of ' + device_data.id + ' to ' + turnon);
			if (turnon) {
				sendCommandToDevice(device_data, 'PO\r'); //POWER ON
				callbackCapability(null, true);
			} else {
				sendCommandToDevice(device_data, 'PF\r'); //POWER OFF
				callbackCapability(null, true);
			}
		}
	}
};
// end capabilities
// start flow action handlers
Homey.manager('flow').on('action.powerOn', function(callback, args) {
	var tempIP = args.device.ipaddress;
	console.log("Pioneer app - flow action powerOn, IP " + tempIP);
	powerOn(tempIP);
	callback(null, true); // we've fired successfully
});
Homey.manager('flow').on('action.powerOff', function(callback, args) {
	var tempIP = args.device.ipaddress;
	powerOff(tempIP);
	callback(null, true); // we've fired successfully
});
Homey.manager('flow').on('action.changeInput', function(callback, args) {
	var input = args.input.inputName;
	var tempIP = args.device.ipaddress;
	changeInputSource(tempIP, input);
	callback(null, true); // we've fired successfully
});
Homey.manager('flow').on('action.changeInput.input.autocomplete', function(callback, value) {
	var inputSearchString = value.query;
	var items = searchForInputsByValue(inputSearchString);
	callback(null, items);
});
Homey.manager('flow').on('action.volumeUp', function(callback, args) {
	var tempIP = args.device.ipaddress;
	var targetVolume = args.volume;
	volumeUp(tempIP, targetVolume);
	callback(null, true); // we've fired successfully
});
Homey.manager('flow').on('action.volumeDown', function(callback, args) {
	var tempIP = args.device.ipaddress;
	var targetVolume = args.volume;
	volumeDown(tempIP, targetVolume);
	callback(null, true); // we've fired successfully
});

function powerOn(hostIP) {
	var command = 'PO\r';
	sendCommandToDevice(hostIP, command);
}

function powerOff(hostIP) {
	var command = 'PF\r';
	sendCommandToDevice(hostIP, command);
}

function changeInputSource(hostIP, input) {
	var command = input;
	sendCommandToDevice(hostIP, command);
}

function volumeUp(hostIP, targetVolume) {
	var command = 'VU\r',
		i = 0,
		busy = false;
	setInterval(function() {
		if (i < parseInt(targetVolume) && !busy) {
			busy = true;
			sendCommandToDevice(hostIP, command, function(response) {
				i++;
				busy = false;
			});
		}
	}, 350);
}

function volumeDown(hostIP, targetVolume) {
	var command = 'VD\r',
		i = 0,
		busy = false;
	setInterval(function() {
		if (i < parseInt(targetVolume) && !busy) {
			busy = true;
			sendCommandToDevice(hostIP, command, function(response) {
				i++;
				busy = false;
			});
		}
	}, 350);
}

function sendCommandToDevice(device, command, callbackCommand) {
	module.exports.getSettings(device, function(err, settings) {
		Homey.log("Pioneer app - got settings " + JSON.stringify(settings));
		tempIP = settings.settingIPAddress;
		sendCommand(tempIP, command, callbackCommand);
	});
}

function sendCommand(hostIP, command, callbackCommand) {
	// clear variable that holds data received from the AVR
	receivedData = "";
	// for logging strip last char which will be the newline \n char
	var displayCommand = command.substring(0, command.length - 1);
	Homey.log("Pioneer app - sending " + displayCommand + " to " + hostIP);
	var client = new net.Socket();
	client.on('error', function(err) {
		Homey.log("Pioneer app - IP socket error: " + err.message);
	});
	client.connect(telnetPort, hostIP);
	client.write(command);
	// get a response
	client.on('data', function(data) {
		var tempData = data.toString().replace("\r", ";");
		Homey.log("Pioneer app - got: " + tempData);
		receivedData += tempData;
	});
	// after a delay, close connection
	setTimeout(function() {
		receivedData = receivedData.replace("\r", ";");
		Homey.log("Pioneer app - closing connection, receivedData: " + receivedData);
		client.end();
		// if we got a callback function, call it with the receivedData
		if (callbackCommand && typeof(callbackCommand) === "function") {
			callbackCommand(receivedData);
		}
	}, 1000);
}

function searchForInputsByValue(value) {
	// for now, consider all known Pioneer inputs
	var possibleInputs = allPossibleInputs;
	var tempItems = [];
	for (var i = 0; i < possibleInputs.length; i++) {
		var tempInput = possibleInputs[i];
		if (tempInput.friendlyName.toLowerCase().indexOf(value.toLowerCase()) >= 0) {
			tempItems.push({
				icon: "",
				name: tempInput.friendlyName,
				inputName: tempInput.inputName
			});
		}
	}
	return tempItems;
}

function initDevice(device_data) {
	devices[device_data.id] = {};
	devices[device_data.id].state = {
		onoff: true
	};
	devices[device_data.id].data = device_data;
}