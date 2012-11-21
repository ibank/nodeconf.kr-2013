
/**
 * Module dependencies.
 */
var fs = require('fs');

var express = require('express');

var app = module.exports = express.createServer()
  , io = require('socket.io').listen(app)
  , userAgent = require('./lib/useragent')
  , DDC11CAR = require('./lib/motor');

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
// app.set('heartbeat timeout',5);
//  app.set('heartbeat interval',10);
 app.set('close timeout',11);
//  app.set('log level',3);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

/**
 * Game Status Data
 */
var player = {}
  , rank = [];

var statistics = {
    totalVisitors : 0
  , playCounts : 0
  , like : 0
};

var dataJSONString = fs.readFileSync('./data.json');

if (dataJSONString.length) {
	statistics = eval('('+dataJSONString+')');
}

setInterval(function(){
	fs.writeFile('./data.json', JSON.stringify(statistics), function(err){
		// console.log('It\'s saved!');
	});		
}, 100);

/**
 * Car instance initialization through Bluetooth
 */
var deviceId = {
    red    : '/dev/tty.FTDEV6-DDC-02-DevB'
  , yellow : '/dev/tty.FTDEV6-DDC-01-DevB'
};

var car = {}; // TODO : NAMING

var connectionLimit = 99;

Object.keys(deviceId).forEach(function(type){
    // Connect Device
    car[type] = DDC11CAR.connect(deviceId[type]);

    // Check Device Object
    if ( !car[type] || !car[type].isConnected ) {
        console.log('Car \''+type+'\' is not available');
        return ;
    }
    // Initialize Device
    car[type].ST();
});

var heartBeatSec = 7000;

// Routes
app.get('/', function(req, res){
  var agent = userAgent.parse(req.headers['user-agent'])
    , platform = agent.platform;

  statistics.totalVisitors++;
 // if ( platform.iphone || platform.ipad || platform.android ) {
	res.render('intro');
//  } else if ( platform.mac || platform.linux || platform.win ) {
//    res.render('pc-intro', { layout : 'pc-layout.ejs' } );
//  }
});

app.get('/pc', function(req, res){
    res.render('pc-intro', { layout : 'pc-layout.ejs' } );
});
app.get('/select', function(req,res) {
	var connections = Object.keys(io.sockets.manager.connected).length || null;
	if ( !connections ) {
		res.redirect('/');
		return ;
	}
	if ( connections < connectionLimit ) {
		res.render('selectCar');
	} else {
		res.render('nocar');
	}
});

app.get('/howto', function(req,res) {
	var connections = Object.keys(io.sockets.manager.connected).length || null;
	if ( !connections ) {
		res.redirect('/');
		return ;
	}

  	var agent = userAgent.parse(req.headers['user-agent'])
    	, platform = agent.platform;

	if ( connections < connectionLimit ) {
		res.render('howto', { platform : platform });
	} else {
		res.render('nocar');
	}
});

app.get('/game', function(req,res) {
	var connections = Object.keys(io.sockets.manager.connected).length || null;
	if ( !connections ) {
		res.redirect('/');
		return ;
	}
  	var agent = userAgent.parse(req.headers['user-agent'])
    	, platform = agent.platform;

	if ( connections < connectionLimit ) {
		res.render('game', { platform : platform });
	} else {
		res.render('nocar');
	}
});

app.get('/rank', function(req,res) {
	var connections = Object.keys(io.sockets.manager.connected).length || null;
	if ( !connections ) {
		res.redirect('/');
		return ;
	}
	if ( connections < connectionLimit ) {
		res.render('record');
	} else {
		res.render('nocar');
	}
});

app.get('/like', function(req,res) {
	var connections = Object.keys(io.sockets.manager.connected).length || null;
	if ( !connections ) {
		res.redirect('/');
		return ;
	}
	res.render('like');
});

app.listen(9999);

io.sockets.on('connection', function (socket) {
	var id = socket.id;
		
	io.sockets.emit('update status', statistics);

	socket.on('like', function(){
		statistics.like += 1;	
	});

	// 사용자가 자동차를 설정할 경우
	socket.on('selectCar', function(data) {
		player[id] = player[id] || {};
		player[id].nick = player[id].nick || '손님'+(statistics.totalVisitors-1);
		player[id].ready = false;
		player[id].car = null;
		player[id].lapCount = 0;
		player[id].LDR = 0;
		player[id].heartbeat = null;
		player[id].lapTime = null;

		socket.emit('car selected');

		if ( car[data.type] && car[data.type].ST ) {
			player[socket.id].car = car[data.type];
			player[socket.id].car.ST();
		}
	});

	// 사용자가 Ready를 누를 경우
	socket.on('set ready', function(data) {
		console.log('set ready : ' + data);
		var currentPlayer = player[socket.id];

		if ( !currentPlayer ) {
			socket.emit('end');		
			return ;
		}
		currentPlayer.heartbeat = setTimeout(function(){
			socket.emit('end');		
		}, heartBeatSec);

		currentPlayer.ready = true;

		if ( !currentPlayer.car ) {
			return ;
		}
		currentPlayer.car.on('LDR', function(data) {
//			console.log('LDR ', currentPlayer.LDR, +data, currentPlayer.LDR-(+data));
			if ( currentPlayer.ready && currentPlayer.LDR - (+data) > 50 ) {
				// Lap Count
				console.log('hit', currentPlayer.LDR, +data , ' count', currentPlayer.lapCount);
				currentPlayer.lapCount += 1;
				if ( currentPlayer.lapCount == 2 ) {
					// 게임 종료
//					console.log('lap end!');
//					currentPlayer.car.ST();
//					currentPlayer.car = null;
//					socket.emit('end');		
				} 
			}
			currentPlayer.LDR = +data;
		});

		currentPlayer.car.on('error', function(data) {
			console.log('connection failed');
		});

		socket.emit('ready');
	});

	socket.on('end race', function(data) {
		var currentPlayer = player[socket.id];

		if ( !currentPlayer ) {
			socket.emit('end','disconnect');
			return ;
		}
		
		currentPlayer.lapTime = data && data.lapTime ? data.lapTime : 'disconnected';
		currentPlayer.ready = false;
		if ( currentPlayer.heartbeat != null ) {
			clearTimeout(currentPlayer.heartbeat);
		}

  		statistics.playCounts++;
		socket.emit('set result',{lapTime :currentPlayer.lapTime});
	});

	// 사용자 종료시 데이터 저장 후 삭제
	socket.on('disconnect', function (data) {
		var currentPlayer = player[socket.id];

		if ( !currentPlayer ) {
			socket.emit('end','disconnect');
			return ;
		}
		console.log('user exit');
		delete player[socket.id];
	});

	socket.on('direction', function(data) {
		var currentPlayer = player[socket.id];

		// 플레이어가 아닌 접속자는 제어 금지
		if ( !currentPlayer ) {
			socket.emit('end','disconnect');
			return ;
		}

		if ( !data || !data.direction ) {
			socket.emit('end','disconnect');
			return ;
		}

		var carObject = null;
		carObject = currentPlayer.car;

		clearTimeout(currentPlayer.heartbeat);
		currentPlayer.heartbeat = null;

		if ( !carObject || !carObject[data.direction] ) {
			console.log('Player '+currentPlayer.nick+'\'s car is move to '+data.direction);
		} else {
			carObject[data.direction]();
		}

		currentPlayer.heartbeat = setTimeout(function(){
			socket.emit('end');		
		}, heartBeatSec);
	});
});

//console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
