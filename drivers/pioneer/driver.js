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
var devices = [];
var PioneerDevices = [];
var cronInterval = null;
/*
(function(port) {
	// console.log('CHECK: ' + port);
	var s = new net.Socket();
	s.setTimeout(timeout, function() {
		s.destroy();
	});
	s.connect(port, host, function() {
		console.log('OPEN: ' + port);
		// we don't destroy the socket cos we want to listen to data event
		// the socket will self-destruct in 2 secs cos of the timeout we set, so no worries
	});
	// if any data is written to the client on connection, show it
	s.on('data', function(data) {
		console.log(port + ': ' + data);
		s.destroy();
	});
	s.on('error', function(e) {
		// silently catch all errors - assume the port is closed
		s.destroy();
	});
})(port);
*/
var isSource = function(source, element) {
		return element.value === source;
	};
var pioneer = {
	status: function(device, callback) {
		//var device = getDeviceByData(device_data);
		if (device instanceof Error) return callback(device);
		pioneer.input.source.get(device, function(pioneer_source) {
			if (pioneer_source !== null &&device.state.source !== pioneer_source.inputName) {
				if (device.state.source !== null) {
					device.state.source = pioneer_source.inputName;
					Homey.manager('flow').triggerDevice('source', {
						'source': pioneer_source.friendlyName
					}, null, device.data, function(err, result) {
						if (err) return Homey.error(err);
					});
				} else {
					device.state.source = pioneer_source.inputName;
				}
			}
			pioneer.power.onoff(device, function(onoff) {
				if (device.state.onoff !== onoff) {
					device.state.onoff = onoff;
				}
				pioneer.mute.onoff(device, function(status, onoff) {
					if (device.state.mute_onoff !== onoff) {
						device.state.mute_onoff = onoff;
						callback();
					}
				});
			});
		});
	},
	power: {
		on: function(device) {
			pioneer.sendCommand(device, 'PO');
		},
		off: function(device) {
			pioneer.sendCommand(device, 'PF');
		},
		onoff: function(device, callback) {
			pioneer.sendCommand(device, '?P', function(receivedData) {
				if(receivedData !== false) {
					// if the response contained "PWR0", the AVR was on. Else it was probably in standby.
					Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' is ' + (receivedData.indexOf("PWR0") >= 0 ? 'powered on' : 'powered off'));
					if (receivedData.indexOf("PWR0") >= 0) {
						callback(true);
					} else {
						callback(false);
					}
				} else {
					callback(false);
				}
			});
		}
	},
	input: {
		source: {
			set: function(device_data, command) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				device.state.source = command;
				pioneer.sendCommand(device, command);
			},
			get: function(device, callback) {
				pioneer.sendCommand(device, "?F", function(receivedData) {
					if(receivedData !== false) {
						var output = null;
						if (typeof(receivedData) === 'object') {
							receivedData.forEach(function(value) {
								if (value.indexOf('FN') !== -1) {
									output = pioneer.input.possibilities.filter(isSource.bind(this, value.replace('\n', '')));
									return false;
								}
							});
						} else {
							output = pioneer.input.possibilities.filter(isSource.bind(this, receivedData.replace('\n', '')));
						}
						if (output !== null && output.length > 0 && output[0] !== undefined) {
							Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' is set to ' + output[0].friendlyName);
							callback(output[0]);
						}
						output = null;
					} else {
						callback(null);
					}
				});
			}
		},
		possibilities: [{
			value: "FN25",
			inputName: "25FN",
			friendlyName: "BD"
		}, {
			value: "FN04",
			inputName: "04FN",
			friendlyName: "DVD"
		}, {
			value: "FN15",
			inputName: "15FN",
			friendlyName: "DVR/BDR"
		}, {
			value: "FN06",
			inputName: "06FN",
			friendlyName: "SAT/CBL"
		}, {
			value: "FN49",
			inputName: "49FN",
			friendlyName: "GAME"
		}, {
			value: "FN01",
			inputName: "01FN",
			friendlyName: "CD"
		}, {
			value: "FN05",
			inputName: "05FN",
			friendlyName: "TV"
		}, {
			value: "FN02",
			inputName: "02FN",
			friendlyName: "Tuner"
		}, {
			value: "FN38",
			inputName: "38FN",
			friendlyName: "Internet Radio"
		}, {
			value: "FN45",
			inputName: "45FN",
			friendlyName: "Favorites"
		}, {
			value: "FN17",
			inputName: "17FN",
			friendlyName: "iPod/USB"
		}, {
			value: "FN10",
			inputName: "10FN",
			friendlyName: "VIDEO 1"
		}, {
			value: "FN14",
			inputName: "14FN",
			friendlyName: "VIDEO 2"
		}, {
			value: "FN19",
			inputName: "19FN",
			friendlyName: "HDMI1"
		}, {
			value: "FN20",
			inputName: "20FN",
			friendlyName: "HDMI2"
		}, {
			value: "FN21",
			inputName: "21FN",
			friendlyName: "HDMI3"
		}, {
			value: "FN22",
			inputName: "22FN",
			friendlyName: "HDMI4"
		}, {
			value: "FN23",
			inputName: "23FN",
			friendlyName: "HDMI5"
		}, {
			value: "FN24",
			inputName: "24FN",
			friendlyName: "HDMI6"
		}, {
			value: "FN48",
			inputName: "48FN",
			friendlyName: "MHL"
		}, {
			value: "FN03",
			inputName: "03FN",
			friendlyName: "CD-R/TAPE"
		}, {
			value: "FN00",
			inputName: "00FN",
			friendlyName: "PHONO"
		}],
		searchByValue: function(value) {
			// for now, consider all known Pioneer inputs
			var tempItems = [];
			for (var i = 0; i < pioneer.input.possibilities.length; i++) {
				var tempInput = pioneer.input.possibilities[i];
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
	},
	volume: {
		up: function(device, targetVolume) {
			for (var i = 0; i < parseInt(targetVolume); i++) {
				setTimeout(function() {
					pioneer.sendCommand(device, 'VU');
				}, i * 500);
			}
		},
		down: function(device, targetVolume) {
			for (var i = 0; i < parseInt(targetVolume); i++) {
				setTimeout(function() {
					pioneer.sendCommand(device, 'VD');
				}, i * 500);
			}
		},
		set: function(device, targetVolume) {
			var volumeMultiplier = 0.4897959183673469;
			if (device.settings.volumeMultiplier !== undefined && device.settings.volumeMultiplier !== null && device.settings.volumeMultiplier.length > 0) {
				volumeMultiplier = Number(device.settings.volumeMultiplier);
			}
			pioneer.sendCommand(device, '?V', function(response) {
				if(receivedData !== false) {
					var currentLevel = Number(response.replace(/^\D+/g, ''));
					var d3 = currentLevel * volumeMultiplier;
					var d4 = targetVolume - d3;
					if (d4 > 0.00) {
						pioneer.volume.up(device, Math.round(d4));
					} else {
						pioneer.volume.down(device, Math.abs(Math.round(d4)));
					}
				}
			});
		},
		get: function() {},
		detectMultiplier: function(device, callback) {
			var commands = [];
			for (var i = 0; i < 100; i++) {
				commands.push({
					command: 'VU',
					time: i * 333
				});
			}
			commands.push({
				command: '?V',
				time: (110 * 333)
			});
			for (var j = 0; j < 100; j++) {
				commands.push({
					command: 'VD',
					time: (j + 120) * 333
				});
			}
			for (var k = 0; k < 10; k++) {
				commands.push({
					command: 'VU',
					time: (k + 230) * 333
				});
			}
			for (var l = 0; l < commands.length; l++) {
				var command = commands[l];
				setTimeout(function(device, command, callback) {
					if (command.command === 'VU' || command.command === 'VD') {
						pioneer.sendCommand(device, command.command);
					} else {
						pioneer.sendCommand(device, '?V', function(response) {
							if(receivedData !== false) {
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
								module.exports.setSettings(device, {
									volumeMultiplier: volumeMultiplier.toString()
								}, function(err, settings) {
									if (err === null) {
										callback(volumeMultiplier, true);
									} else {
										callback(err, false);
									}
								});
							} else {
								callback(err, false);
							}
						});
					}
				}, command.time, device, command, callback);
			}
		}
	},
	mute: {
		on: function(device) {
			pioneer.sendCommand(device, 'MO');
		},
		off: function() {
			pioneer.sendCommand(device, 'MF');
		},
		onoff: function(device, callback) {
			pioneer.sendCommand(device, '?M', function(receivedData) {
				if(receivedData !== false) {
					// if the response contained "MUT1", the AVR was muted. Else it was unmuted.
					Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' is ' + (receivedData.indexOf("MUT0") > -1 ? 'muted on' : 'muted off'));

					if (receivedData.indexOf("MUT0") > -1) {
						callback(null, true);
					} else {
						callback(null, false);
					}
				} else {
					callback(null, false);
				}
			});
		}
	},
	sendCommand: function(device, command, callbackCommand) {
		if (device !== undefined && device !== null && typeof(device) === 'object') {
			if (device.settings !== undefined && typeof(device.settings) === 'object' && device.settings.ip !== undefined && device.settings.ip !== null && device.settings.ip.length > 0) {
				// clear variable that holds data received from the AVR
				command = command + "\r";
				// for logging strip last char which will be the newline \n char
				var displayCommand = command.substring(0, command.length - 1);
				Homey.log("Pioneer app - sending " + displayCommand + " to " + device.settings.ip);
				var client = new net.Socket();
				var response = null;
				client.on('error', function(err) {
					Homey.log("Pioneer app - IP socket error: " + err.message);
					if(typeof(err) !== 'undefined' && typeof(err.message) === 'string') {
						if (err.message.indexOf("EHOSTUNREACH") >= 0) {
							module.exports.setUnavailable(getDataByDevice(device), __("EHOSTUNREACH"));
							callbackCommand(false);
						} else if (err.message.indexOf("ETIMEDOUT") >= 0) {
							module.exports.setUnavailable(getDataByDevice(device), __("ETIMEDOUT"));
							callbackCommand(false);
						} else if (err.message.indexOf("ECONNREFUSED") >= 0) {
							telnetIndex++;
							if (telnetPort[telnetIndex] === undefined) {
								module.exports.setUnavailable(getDataByDevice(device), __("ECONNREFUSED"));
								callbackCommand(false);
							}
						}
					}
				});
				// get a response
				client.on('data', function(data) {
					response = data;
					module.exports.setAvailable(getDataByDevice(device));
					if (callbackCommand && typeof(callbackCommand) === "function") {
						response = null;
						if ((data.toString().match(/\r\n/g) || []).length > 1) {
							callbackCommand(data.toString().split("\r\n"));
						} else {
							callbackCommand(data.toString().replace("\r", ""));
						}
						client.destroy();
					}
				});
/*
				client.on('close', function() {
					if (response === null) {
						module.exports.setUnavailable(getDataByDevice(device), __("device_unavailable"));
					} else {
						module.exports.setAvailable(getDataByDevice(device));
					}
				});
*/
				client.connect(telnetPort[telnetIndex], device.settings.ip);
				client.write(command);
			}
		}
	}
};
// the `init` method is called when your driver is loaded for the first time
module.exports = {
	init: function(devices_data, callback) {
		devices_data.forEach(function(device_data) {
			initDevice(device_data);
		});
/*
		// Get all cron tasks
		Homey.manager('cron').getTasks(function(err, task) {
			if (err === null && task.length === 0) {
				// Register a cron task
				Homey.manager('cron').unregisterTask('pioneer', function(err, task) {});
			}
		});
*/
		callback();
		setInterval(function() {
			devices_data.forEach(function(device_data) {
				pioneer.status(device_data, function() {
					return true;
				});
			});
		}, 11459);
	},
	pair: function(socket) {
		// socket is a direct channel to the front-end
		// this method is run when Homey.emit('list_devices') is run on the front-end
		// which happens when you use the template `list_devices`
		socket.on('list_devices', function(device_data, callback) {
			callback(null, [device_data]);
		});
		socket.emit('continue', null);
	},
	added: function(device_data, callback) {
		initDevice(device_data);
		callback(null, true);
	},
	renamed: function(device_data, new_name) {
		// run when the user has renamed the device in Homey.
		// It is recommended to synchronize a device's name, so the user is not confused
		// when it uses another remote to control that device (e.g. the manufacturer's app).
		Homey.log("Pioneer app - device renamed: " + JSON.stringify(device_data) + " new name: " + new_name);
		// update the devices array we keep
		devices[device_data.id].data.name = new_name;
	},
	deleted: function(device_data, callback) {
		delete devices[device_data.id];
		callback(null, true);
	},
	settings: function(device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
		// run when the user has changed the device's settings in Homey.
		// changedKeysArr contains an array of keys that have been changed, for your convenience :)
		// always fire the callback, or the settings won't change!
		// if the settings must not be saved for whatever reason:
		// callback( "Your error message", null );
		// else callback( null, true );
		Homey.log('Pioneer app - Settings were changed: ' + JSON.stringify(device_data) + ' / ' + JSON.stringify(newSettingsObj) + ' / old = ' + JSON.stringify(oldSettingsObj) + ' / changedKeysArr = ' + JSON.stringify(changedKeysArr));

		devices[device_data.id].settings = newSettingsObj;
		try {
			changedKeysArr.forEach(function(key) {
				switch (key) {
				case 'ip':
					Homey.log('Pioneer app - IP address changed to ' + newSettingsObj.ip);
					pioneer.status(devices[device_data.id]);
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
			module.exports.setAvailable(device_data);
			if (newSettingsObj.volumeMultiplier === undefined || newSettingsObj.volumeMultiplier === null || newSettingsObj.volumeMultiplier.length === 0) {
				Homey.log('Pioneer app - Get maximum volume of ' + newSettingsObj.ip);
				pioneer.volume.detectMultiplier(device_data, newSettingsObj.ip, function(message, status) {
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
	},
	capabilities: {
		onoff: {
			get: function(device_data, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				pioneer.power.onoff(device, function(onoff) {
					device.state.onoff = onoff;
					return callback(null, onoff);
				});
			},
			set: function(device_data, onoff, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' to ' + (onoff ? 'power on' : 'power off'));
				if (onoff) {
					pioneer.power.on(device);
				} else {
					pioneer.power.off(device);
				}
				device.state.onoff = onoff;
				return callback(null, true);
			}
		},
		volume_set: {
			get: function(device_data, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				pioneer.volume.get(device, function(volume) {
					if (device.state.volume_set !== volume) {
						device.state.volume_set = volume;
						module.exports.realtime(device_data, 'volume', device.state.volume);
					}
					return callback(null, device.state.volume_set);
				});
			},
			set: function(device_data, volume, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' to volume ' + volume);
				pioneer.volume.set(device, volume);
				device.state.volume_set = volume;
				return callback(null, true);
			}
		},
		volume_up: {
			get: function(device_data, callback) {
				return callback(null, true);
			},
			set: function(device_data, volume, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}				Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' to volume ' + volume);
				pioneer.volume.up(device, volume);
				device.state.volume_set = volume;
				return callback(null, true);
			}
		},
		volume_down: {
			get: function(device_data, callback) {
				return callback(null, true);
			},
			set: function(device_data, volume, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' to volume ' + volume);
				pioneer.volume.down(device, volume);
				device.state.volume_set = volume;
				return callback(null, true);
			}
		},
		volume_mute: {
			get: function(device_data, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				pioneer.mute.onoff(device, function(status, onoff) {
					device.state.mute_onoff = onoff;

					return callback(status, onoff);
				});
			},
			set: function(device_data, onoff, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				Homey.log('Pioneer app - Setting device_status of ' + device.settings.ip + ' to ' + (onoff ? 'mute' : 'unmute'));
				if (onoff) {
					pioneer.mute.on(device);
				} else {
					pioneer.mute.off(device);
				}
				device.state.mute_onoff = onoff;
				return callback(null, true);
			}
		},
		pioneer_source: {
			get: function(device_data, callback) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				pioneer.input.source.get(device, function(pioneer_source) {
					//Homey.log(pioneer_source);
					if (pioneer_source !== null && device.state.source !== pioneer_source.inputName) {
						device.state.source = pioneer_source.inputName;
						module.exports.realtime(device_data, 'pioneer_source', device.state.source);
					}
				});
				return callback(null, device.state.source);
			},
			set: function(device_data, pioneer_source, callback) {
				Homey.log(device_data);
				var device = getDeviceByData(device_data);
				if (device instanceof Error) {
					device = device_data;
				}
				pioneer.input.source.set(device, pioneer_source);
				return callback(null, true);
			}
		}
	}
};
Homey.manager('flow').on('trigger.source', function(callback, args) {
	callback(null, true); // If true, this flow should run. The callback is (err, result)-style.
});
Homey.manager('flow').on('condition.get_volume_mute', function(callback, args) {
	pioneer.mute.onoff(args.device, callback);
});
Homey.manager('flow').on('action.change_input.input.autocomplete', function(callback, value) {
	callback(null, pioneer.input.searchByValue(value.query));
});
Homey.manager('flow').on('action.change_input', function(callback, args) {
	pioneer.input.source.set(args.device, args.input.inputName);
	callback(null, true);
});
Homey.manager('flow').on('action.change_volume_up', function(callback, args) {
	pioneer.volume.up(args.device, args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.change_volume_down', function(callback, args) {
	pioneer.volume.down(args.device, args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.change_volume_set', function(callback, args) {
	pioneer.volume.set(args.device, args.volume);
	callback(null, true);
});
Homey.manager('flow').on('action.change_volume_mute', function(callback, args) {
	if(args.onoff === 'on') {
		pioneer.mute.on(args.device, args.volume);
	} else {
		pioneer.mute.off(args.device, args.volume);
	}
	callback(null, true);
});
// when a task is fired. event name is equal to the task name
Homey.manager('cron').on('pioneer', function(devices_data) {
	if(cronInterval !== null) {
		clearInterval(cronInterval);
	}

	if (false && devices_data.length <= 5) {
		cronInterval = setInterval(function() {
			devices_data.forEach(function(device_data) {
				var device = getDeviceByData(device_data);
				if (device instanceof Error) return callback(device);
				pioneer.status(device, function() {
					return true;
				});
			});
		}, devices_data.length * 10000);
	} else {
		devices_data.forEach(function(device_data) {
			var device = getDeviceByData(device_data);
			if (device instanceof Error) return callback(device);
			pioneer.status(device, function() {
				return true;
			});
		});
	}
});
// a helper method to get a device from the devices list by it's device_data object
var getDeviceByData = function(device_data) {
		if (typeof device_data === 'undefined') {
			return new Error("invalid_device");
		}
		var device = devices[device_data.id];
		if (typeof device === 'undefined') {
			return new Error("invalid_device");
		} else {
			return device;
		}
	};
var getDataByDevice = function(device_data) {
		if (typeof device_data === 'undefined') {
			return new Error("invalid_device");
		}
		return device_data.data;
	};
// a helper method to add a device to the devices list
var initDevice = function(device_data) {
		devices[device_data.id] = {};
		devices[device_data.id].state = {
			onoff: true,
			mute_onoff: false,
			volume: 0,
			source: null
		};
		devices[device_data.id].data = device_data;
		module.exports.getSettings(device_data, function(err, settings) {
			devices[device_data.id].settings = settings;
			if (settings.telnetPort !== undefined && settings.telnetPort !== null && settings.telnetPort > 0) {
				telnetPort.push(settings.telnetPort);
			}
		});
	};