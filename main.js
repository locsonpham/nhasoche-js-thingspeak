/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */
// Leave the above lines for propper jshinting
//Type Node.js Here :)
var SerialPort = require('serialport').SerialPort;
var modbus = require('modbus-rtu');
var serialPath = "/dev/ttyUSB0";
var baud = 9600;

var retryConnectSerial = function(serialPort) {
	serialPort = new SerialPort(serialPath, {
		baudrate: baud
	}, function (err) {
		if (err) {
			retryConnectSerial(serialPort);
		} else {
			console.log("serialPort is 2_opened: " + serialPort.isOpen());
		}
	});
};

var serialPort = new SerialPort(serialPath, {
	baudrate: baud
}, function (err) {
	if (err) {
		setTimeout(function () {
			retryConnectSerial(serialPort);
		}, 2000);
	} else {
		console.log("serialPort is 1_opened: " + serialPort.isOpen());
	}
});

//create ModbusMaster instance and pass the serial port object
var master = new modbus.Master(serialPort, function() {
		console.log("Modbus Master OK");
});

var Promise = require('bluebird');
var promises = [];
var err_flag = false;
var err_msg = null;
var loop_cnt = 0;
var data_msg1 = [];
var data_msg2 = [];

function loop() {
	console.log(loop_cnt);

	if (loop_cnt%10 === 0) {
		console.log("update sensor");

		promises.push(master.readHoldingRegisters(102, 0, 2).then(function(data){
            //promise will be fulfilled with parsed data
            console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
			if (data[0] !== 0) {
				data_msg1 = data;
			}

		}, function(err){
            //or will be rejected with error
            console.log(err);
		}));
		
		promises.push(master.readHoldingRegisters(103, 0, 2).then(function(data){
            //promise will be fulfilled with parsed data
            console.log(data); //output will be [10, 100, 110, 50] (numbers just for example)
			if (data[0] !== 0) {
				data_msg2 = data;
			}

		}, function(err){
            //or will be rejected with error
            console.log(err);
		}));
	}
	
	if (loop_cnt%300 === 0) {  // 5 min
		//Update thingSpeakUpdate
        console.log("update thingspeak");
		thingSpeakUpdate(data_msg1[0]/10, data_msg1[1]/10, data_msg2[0]/10, data_msg2[1]/10);
	}
	

	Promise.all(promises).catch(function(err) {
		err_flag = true;
		err_msg = err;
		console.log(err);	

		if (serialPort.isOpen() === false) {
			console.log("Port not Open");
			promises = [];

			serialPort = new SerialPort(serialPath, {
				baudrate: baud
			}, function (err) {
				if (err) {
				} else {
					serialPort.close();
					new modbus.Master(serialPort, function(master2) {
						console.log("create alt-modbus: master2");
						master = master2;
					});
					serialPort.open();
				}
			});
		}
	}).finally(function() {
		if (err_flag) {
		} else {
		}
	});
	
	// Increase main counter
	loop_cnt++;
}

// Set main loop
setInterval(function () {
	loop();
}, 1000);

// Send data to server
var request = require('request');

function thingSpeakUpdate(val1, val2, val3, val4) {
	// Set the headers
	var headers = {
        'User-Agent':       'Super Agent/0.0.1',
        'Content-Type':     'application/x-www-form-urlencoded'
	};

	// Configure the request
	var options = {
		url: 'https://api.thingspeak.com/update',
		method: 'GET',
		headers: headers,
		form: {
			'key': '7NTUUUCOYH7JQH74',
			'field1': val1,
			'field2': val2,
			'field3': val3,
			'field4': val4
		}
	};

	// Start the request
	request(options, function(err, res, body) {
		if(!err && res.statusCode == 200) {
			console.log(body);
		}
	});
}