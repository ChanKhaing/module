const { io } = require('socket.io-client');
const token = process.argv[2];

const socket = io('http://localhost:3000', {
  auth: { token },
  transports: ['websocket'],
  timeout: 5000,
  reconnection: false,
});

let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log('CONNECTED:' + socket.id);
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (err) => {
  console.log('CONNECT_ERROR:' + err.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  if (!connected) {
    console.log('DISCONNECT_BEFORE_CONNECT:' + reason);
    process.exit(1);
  }
});

socket.on('auth:error', (data) => {
  console.log('AUTH_ERROR:' + data.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('TIMEOUT');
  process.exit(1);
}, 8000);
