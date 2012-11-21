var util = require("util")
, events = require("events")
, EventEmitter = events.EventEmitter;

var DDC_CAR_UP = 0xE1
, DDC_CAR_DN = 0xE2
, DDC_CAR_LT = 0xE3
, DDC_CAR_RT = 0xE4
, DDC_CAR_ST = 0xE5
, DDC_CAR_UL = 0xE6
, DDC_CAR_UR = 0xE7
, DDC_CAR_DL = 0xE8
, DDC_CAR_DR = 0xE9
, DDC_CAR_CT = 0xF0;

function _DDC_CAR(connectPort) {
    events.EventEmitter.call(this);
    
    this.sendCount = 0;
    this.recvCount = 0;

    this.heartBeatTimer = null;
    this.checkBeatTimer = null;
    this.retryTimer = null;
    this.isRetry = false;
    this.isConnected = false;

    var arduino = require('arduino')
      , board = null;


    this.on('error',
        (function(_self){
            return function(data) {
                _self.isConnected = false;
                console.log('[arduino-rc] '+connectPort+' connection error');
            };
        })(this)
    );

    this.on('close',
        (function(_self){
            return function(data) {
                clearInterval(_self.heartBeatTimer);
                clearInterval(_self.checkBeatTimer);
                _self.isConnected = false;
                console.log('[arduino-rc] '+connectPort+' connection closed');
            };
        })(this)
    );

    this.on('retry' ,
        (function(_self){
            return function(data) {
                clearInterval(_self.heartBeatTimer);
                clearInterval(_self.checkBeatTimer);
                _self.isConnected = false;
                _self.retryTimer = setInterval(
                    (function(_self){
                        return function(){
                            if ( _self.connect() ) {
                                _self.isRetry = false;
                                clearInterval(_self.retryTimer);
                                console.log('[arduino-rc] '+connectPort+' connection restart');
                            } else {
                                console.log('[arduino-rc] try '+connectPort+' connecting...');
                            }
                        };
                    })(_self), 3000);
            };
        })(this)
    );

    this.connect = function () {
        var _self = this;
        try {
            if ( board ) {
                board.sp.close();
                board.sp = null;
                board = null;
            }
            board = arduino.connect(connectPort);
            console.log(board);
            if ( !board ) {
                throw new Error();
            }
            // LDR Sensor
            board.pinMode(1, arduino.INPUT);

            _self.isConnected = true;
            _self.sendCount = 0;
            _self.recvCount = 0;
            
            function heartBeat(_self) {
                return function() {
                    try {
                        _self.sendCount++;
                        board.analogRead(1, (function(_self) {
                            return function(data){
                                _self.recvCount++;
                                _self.emit('LDR', data); };
                        })(_self));
                    } catch(e) {
                        console.log(e);
                        _self.emit('error',_self);
                    }
                };
            }

            function checkBeat(_self) {
                return function() {
                    if ( (_self.sendCount - _self.recvCount) > 50 ) {
                        console.log(_self.sendCount, _self.recvCount);
                        console.log('[arduino-rc] '+connectPort+' DISCONNECTED!!');
                        if ( !_self.isRetry ) {
                            _self.emit('retry');
                            _self.isRetry = true;
                        }
                    } else {
      //                  console.log('[arduino-rc] '+connectPort+' STAY TUNE...');
                    }
                };
            }
            _self.heartBeatTimer = setInterval( heartBeat(_self), 150 );
            _self.checkBeatTimer = setInterval( checkBeat(_self), 200 );
            
        } catch(e) {
            this.emit('close');
            return false;
        }
        return true;
    };

    this.disconnect = function(isReconnect) {
        if ( !board || !board.sp ) {
            return ;
        }
        this.emit('close', isReconnect || false );
    };

    if ( !this.connect() ) {
        return ;
    }

    this.LT = function () {
        board.sp.write(new Buffer([DDC_CAR_LT]), 1);
    };

    this.RT = function () {
        board.sp.write(new Buffer([DDC_CAR_RT]), 1);
    };

    this.UP = function () {
        board.sp.write(new Buffer([DDC_CAR_UP]), 1);
    };

    this.DN = function () {
        board.sp.write(new Buffer([DDC_CAR_DN]), 1);
    };

    this.ST = function () {
        board.sp.write(new Buffer([DDC_CAR_ST]), 1);
    };

    this.UL = function () {
        board.sp.write(new Buffer([DDC_CAR_UL]), 1);
    };

    this.UR = function () {
        board.sp.write(new Buffer([DDC_CAR_UR]), 1);
    };

    this.DL = function () {
        board.sp.write(new Buffer([DDC_CAR_DL]), 1);
    };

    this.DR = function () {
        board.sp.write(new Buffer([DDC_CAR_DR]), 1);
    };

	this.CT = function () {
        board.sp.write(new Buffer([DDC_CAR_CT]), 1);
	};
}

util.inherits(_DDC_CAR, events.EventEmitter);

exports.connect = function(connectPort) {
    return new _DDC_CAR(connectPort);
};
