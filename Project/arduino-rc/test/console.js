var stdin = process.stdin,
	stdout = process.stdout,
//	MotorControl = require('./motor').connect('/dev/tty.RCPlayer1');
	MotorControl = require('../lib/motor').connect('/dev/tty.FTDEV6-DDC-01-DevB');
//	MotorControl = require('./motor').connect('/dev/tty.usbmodem621');
//	MotorControl = require('../lib/motor').connect('/dev/tty.usbmodem1d181');

MotorControl.on('data', function(data) { console.log(data);} );

stdin.resume();

console.log('Ready...');
console.log('Command : UP DN LT RT UL UR DL DR ST');

stdin.on('data', function(data) {
	data = data.toString().trim();
	
	if ( MotorControl[data] ) {
		MotorControl[data]();
	} else {
		console.log('Wrong Command.');
		console.log('Command : UP DN LT RT UL UR DL DR ST');
	}
});
