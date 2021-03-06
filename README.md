# Pioneer VSX control app for Athom Homey

This app lets you control a Pioneer VSX amplifier from within flows on a Homey device (by Athom).

##What works:

* Turn on and off you amplifier in a flow card
* Set volume up and down in a flow card
* Change the input source of your VSX amplifier in a card
* Mute and unmute your VSX amplifier

##Version 1.0.0

* Added: Flow condition to check if your amplifier is on or off
* Added: Switch to port 23 to support other devices
* Improved: Mobile card
* Removed: Unnecessary files so the app take less space on your Homey

##Version 1.1.0

* Added: Device selection to flow condition to check if your amplifier is on or off introduced in 1.0.x
* Added: Flow action to set the volume to a specific level.
* Added: Calibration function to detect the maximum level of the Pioneer so the level within the flow can be set.
* Added: Settings to change the IP of the Pioneer and add option to add port nummer if the port number is different than the default 8102 or 23
* Improved: Adding of devices

##Version 1.2.0

* Added: Flow action to mute and unmute your amplifier
* Added: Flow condition to check if your amplifier is muted or unmuted

##Version 1.3.0

* Improved: Yes no text in flow condition
* Improved: Uniformity in action flows by selecting first device witch was not the case by changing source.

##Version 1.3.1

* Fixed: API callback issues, after upgrading to Homey 0.10.x

##Version 1.3.3

* Added: Notification of incorrect device

##Version 1.3.6

* Fixed: Issue with GAME port

##Supported devices

###Confirmed
* Pioneer SC-2023-K
* Pioneer SC-LX57
* Pioneer VSX-528
* Pioneer VSX-824
* Pioneer VSX-920
* Pioneer VSX-921
* Pioneer VSX-924
* Pioneer VSX 1021

###Unconfirmed
* Pioneer SC-1223
* Pioneer VSX-42
* Pioneer VSX-43
* Pioneer VSX-51
* Pioneer VSX-527
* Pioneer VSX-822
* Pioneer VSX-921-K
* Pioneer VSX-922
* Pioneer VSX-923
* Pioneer VSX-923-K
* Pioneer VSX-1023
* Pioneer VSX-2120
* Pioneer VSX-S510

Please let me know if your Pioneer is supported
