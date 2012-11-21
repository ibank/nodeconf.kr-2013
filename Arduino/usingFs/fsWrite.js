var fs = require('fs');

fs.open('/dev/tty.usbmodem411', 'a', 0666, function( err, fd ) {
  if ( err ) throw err;

  fs.write(fd, '0', null, null, null, function() {
    fs.close(fd, function() {
    });
  });

});
