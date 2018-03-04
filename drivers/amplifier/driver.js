var net = require('net');
// Temporarily store the device's IP address and name. For later use, it gets added to the device's settings
var tempIP = '';
var tempDeviceName = '';
// Variable to hold responses from the AVR
var receivedData = "";
// The Pioneer IP network interface uses port 8102 as telnet port
var telnetPort = [8102, 23];
var telnetIndex = 0;
var defaultMultiplier = "0.4897959183673469";
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
	inputName: "49FN\r",
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
// the `init` method is called when your driver is loaded for the first time
module.exports.init = function(devices_data, callback) {
	devices_data.forEach(function(device_data) {
		initDevice(device_data);
	});
	callback();
};
// start of pairing functions
module.exports.pair = function(socket) {
	// socket is a direct channel to the front-end
	// this method is run when Homey.emit('list_devices') is run on the front-end
	// which happens when you use the template `list_devices`
	socket.on('list_devices', function(device_data, callback) {
		callback(null, [device_data]);
	});
	socket.emit('continue', null);
};
// end pair
module.exports.added = function(device_data, callback) {
	initDevice(device_data);
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
module.exports.deleted = function(device_data, callback) {
	delete devices[device_data.id];
	callback(null, true);
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
			case 'telnetPort':
				telnetPort.push(newSettingsObj.telnetPort);
				break;
			}
		});
	} catch (error) {
		callback(error, null);
	}
	try {
		if (newSettingsObj.volumeMultiplier === undefined || newSettingsObj.volumeMultiplier === null || newSettingsObj.volumeMultiplier.length === 0) {
			Homey.log('Pioneer app - Get maximum volume of ' + newSettingsObj.settingIPAddress);
			detectVolumeMultiplier(newSettingsObj.settingIPAddress, device_data, function(message, status) {
				if (status) {
					if (message !== null) {
						callback(null, true);
					} else {
						callback(message, status);
					}
				}
			});
		} else {
			callback(null, true);
		}
	} catch (error) {
		callback(error, null);
	}
};
// capabilities
module.exports.capabilities = {
	onoff: {
		get: function(device_data, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			powerOnOff(device, function(onoff) {
				device.state.onoff = onoff;
				return callback(null, device.state.onoff);
			});
		},
		set: function(device_data, onoff, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			Homey.log('Pioneer app - Setting device_status of ' + device.settings.settingIPAddress + ' to ' + (onoff ? 'power on' : 'power off'));
			if (onoff) {
				powerOn(device);
			} else {
				powerOff(device);
			}
			device.state.onoff = onoff;
			module.exports.realtime(device_data, 'onoff', device.state.onoff);
			return callback(null, device.state.onoff);
		}
	},
	volume_set: {
		get: function(device_data, callback) {
			return callback(null, true);
		},
		set: function(device_data, volume, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			Homey.log('Pioneer app - Setting device_status of ' + device.settings.settingIPAddress + ' to volume ' + volume);
			volume_set(volume);
			device.state.volume_set = volume;
			module.exports.realtime(device_data, 'volume', device.state.volume);
			return callback(null, device.state.volume);
		}
	},
	volume_up: {
		get: function(device_data, callback) {
			return callback(null, true);
		},
		set: function(device_data, volume, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			Homey.log('Pioneer app - Setting device_status of ' + device.settings.settingIPAddress + ' to volume ' + volume);
			volume_up(volume);
			device.state.volume_set = volume;
			module.exports.realtime(device_data, 'volume', device.state.volume);
			return callback(null, device.state.volume);
		}
	},
	volume_down: {
		get: function(device_data, callback) {
			return callback(null, true);
		},
		set: function(device_data, volume, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			Homey.log('Pioneer app - Setting device_status of ' + device.settings.settingIPAddress + ' to volume ' + volume);
			volume_down(volume);
			device.state.volume_set = volume;
			module.exports.realtime(device_data, 'volume', device.state.volume);
			return callback(null, device.state.volume);
		}
	},
	volume_mute: {
		get: function(device_data, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			return callback(null, device.state.mute_onoff);
		},
		set: function(device_data, mute_onoff, callback) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			Homey.log('Pioneer app - Setting device_status of ' + device.settings.settingIPAddress + ' to ' + (onoff ? 'mute' : 'unmute'));

			if (mute_onoff) {
				sendCommand(device, 'MO\r');
			} else {
				sendCommand(device, 'MF\r');
			}

			device.state.mute_onoff = mute_onoff;
			module.exports.realtime(device_data, 'volume_mute', device.state.mute_onoff);
			return callback(null, device.state.mute_onoff);
		}
	}
};
// end capabilities
// start flow action handlers
Homey.manager('flow').on('action.powerOn', function(callback, args) {
	module.exports.realtime(args.device, 'onoff', true);
	callback(null, true);
});
Homey.manager('flow').on('action.powerOff', function(callback, args) {
	module.exports.realtime(args.device, 'onoff', false);
	callback(null, true);
});
Homey.manager('flow').on('condition.powerOnOff', function(callback, args) {
	device = getDeviceByData(args.device);
	powerOnOff(device, function(onoff) {
		device.state.onoff = onoff;
		callback(null, onoff);
	});
});
Homey.manager('flow').on('action.changeInput', function(callback, args) {
	input_source(args.device, args.input.inputName);
	callback(null, true);
});
Homey.manager('flow').on('action.changeInput.input.autocomplete', function(callback, value) {
	callback(null, searchForInputsByValue(value.query));
});
Homey.manager('flow').on('action.volumeUp', function(callback, args) {
	module.exports.realtime(args.device, "volume_up", args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.volumeDown', function(callback, args) {
	module.exports.realtime(args.device, "volume_down", args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.changeVolume', function(callback, args) {

	module.exports.realtime(args.device, "volume_set", args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.mute', function(callback, args) {
	module.exports.realtime(args.device, "volume_set", (args.onoff === 'on'));
	callback(null, true);
});
Homey.manager('flow').on('condition.muteOnOff', function(callback, args) {
	muteOnOff(args.device, function(onoff) {
		callback(null, onoff);
	});
});
var muteOnOff = function(device, callback) {
		sendCommand(device, '?M\r', function(receivedData) {
			// if the response contained "MUT1", the AVR was muted. Else it was unmuted.
			if (receivedData.indexOf("MUT0") > -1) {
				callback(true);
			} else if (receivedData.indexOf("MUT1") > -1) {
				callback(false);
			}
		});
	};
var powerOn = function(device) {
		sendCommand(device, 'PO\r');
	};
var powerOff = function(device) {
		sendCommand(device, 'PF\r');
	};
var powerOnOff = function(device, callback) {
		sendCommand(device, '?P\r', function(receivedData) {
			// if the response contained "PWR0", the AVR was on. Else it was probably in standby.
			Homey.log(receivedData);
			if (receivedData.indexOf("PWR0") >= 0) {
				callback(true);
			} else {
				callback(false);
			}
		});
	};
var input_source = function(device, command) {
		sendCommand(device, command);
	};
var volume_up = function(device, targetVolume) {
		for (var i = 0; i < parseInt(targetVolume); i++) {
			setTimeout(function() {
				sendCommand(device, 'VU\r');
			}, i * 500);
		}
	};
var volume_down = function(device, targetVolume) {
		for (var i = 0; i < parseInt(targetVolume); i++) {
			setTimeout(function() {
				sendCommand(device, 'VD\r');
			}, i * 500);
		}
	};
var volume_set = function(device, targetVolume) {
		if (device.settings !== undefined) {
			var volumeMultiplier = 0.4897959183673469;
			if (device.settings.volumeMultiplier !== undefined && device.settings.volumeMultiplier !== null && device.settings.volumeMultiplier.length > 0) {
				volumeMultiplier = Number(device.settings.volumeMultiplier);
			}
			sendCommand(device, '?V\r', function(response) {
				var currentLevel = Number(response.replace(/^\D+/g, ''));
				var d3 = currentLevel * volumeMultiplier;
				var d4 = targetVolume - d3;
				if (d4 > 0.00) {
					volume_up(device, Math.round(d4));
				} else if (d4 < 0.00) {
					volume_down(device, Math.abs(Math.round(d4)));
				}
			});
		}
	};
var detectVolumeMultiplier = function(device, device_data, callback) {
		var commands = [];
		for (var i = 0; i < 100; i++) {
			commands.push({
				command: 'VU\r',
				time: i * 333
			});
		}
		commands.push({
			command: '?V\r',
			time: (110 * 333)
		});
		for (var j = 0; j < 100; j++) {
			commands.push({
				command: 'VD\r',
				time: (j + 120) * 333
			});
		}
		for (var k = 0; k < 10; k++) {
			commands.push({
				command: 'VU\r',
				time: (k + 230) * 333
			});
		}
		for (var l = 0; l < commands.length; l++) {
			var command = commands[l];
			setTimeout(function(device, device_data, command, callback) {
				if (command.command === 'VU\r' || command.command === 'VD\r') {
					sendCommand(device, command.command);
				} else {
					sendCommand(device, '?V\r', function(response) {
						var maxLevel = Number(response.replace(/^\D+/g, ''));
						Homey.log(JSON.stringify({
							'maxLevel': maxLevel
						}));
						var maxVolume = Math.floor((maxLevel / 2) - 1);
						Homey.log(JSON.stringify({
							'maxVolume': maxVolume
						}));
						var volumeMultiplier = maxVolume / maxLevel;
						Homey.log(JSON.stringify({
							'volumeMultiplier': volumeMultiplier
						}));
						module.exports.setSettings(device_data, {
							volumeMultiplier: volumeMultiplier.toString()
						}, function(err, settings) {
							if (err === null) {
								callback(volumeMultiplier, true);
							} else {
								callback(err, false);
							}
						});
					});
				}
			}, command.time, device, device_data, command, callback);
		}
	};
var sendCommand = function(device, command, callbackCommand) {
		if (device !== undefined && typeof(device) === 'object') {
			if(device.settings === undefined || typeof(device.settings) !== 'object' || device.settings.settingIPAddress === undefined || device.settings.settingIPAddress === null || device.settings.settingIPAddress.length === 0) {
				device = getDeviceByData(device);
			}
			if (device.settings !== undefined && typeof(device.settings) === 'object' && device.settings.settingIPAddress !== undefined && device.settings.settingIPAddress !== null && device.settings.settingIPAddress.length > 0) {
				Homey.log(device.settings !== undefined && typeof(device.settings) === 'object' && device.settings.settingIPAddress !== undefined && device.settings.settingIPAddress !== null && device.settings.settingIPAddress.length > 0);

				// clear variable that holds data received from the AVR
				receivedData = "";
				// for logging strip last char which will be the newline \n char
				var displayCommand = command.substring(0, command.length - 1);
				//Homey.log("Pioneer app - sending " + displayCommand + " to " + hostIP);
				var client = new net.Socket();
				client.on('error', function(err) {
					Homey.log("Pioneer app - IP socket error: " + err.message);
					if (err.message.indexOf("ECONNREFUSED") >= 0) {
						telnetIndex++;
						if (telnetPort[telnetIndex] === undefined) {
							telnetIndex = 0;
						}
					}
				});
				client.connect(telnetPort[telnetIndex], device.settings.settingIPAddress);
				client.write(command);
				// get a response
				client.on('data', function(data) {
					var tempData = data.toString().replace("\r", "");
					//Homey.log("Pioneer app - got: " + tempData);
					receivedData += tempData;
				});
				// after a delay, close connection
				setTimeout(function() {
					receivedData = receivedData.replace("\r", "");
					//Homey.log("Pioneer app - closing connection, receivedData: " + receivedData);
					client.end();
					// if we got a callback function, call it with the receivedData
					if (callbackCommand && typeof(callbackCommand) === "function") {
						callbackCommand(receivedData);
					}
				}, 1000);
			}
		}
	};
var searchForInputsByValue = function(value) {
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
	};
// a helper method to get a device from the devices list by it's device_data object
var getDeviceByData = function(device_data) {
		var device = devices[device_data.id];
		if (typeof device === 'undefined') {
			return new Error("invalid_device");
		} else {
			return device;
		}
	};
// a helper method to add a device to the devices list
var initDevice = function(device_data) {
		devices[device_data.id] = {};
		devices[device_data.id].state = {
			onoff: true,
			mute_onoff: false,
			volume: 0
		};
		devices[device_data.id].data = device_data;
		module.exports.getSettings(device_data, function(err, settings) {
			devices[device_data.id].settings = settings;
			if (settings.telnetPort !== undefined && settings.telnetPort !== null && settings.telnetPort > 0) {
				telnetPort.push(settings.telnetPort);
			}
		});
	};