const { io } = require('socket.io-client');

const token = process.argv[2] || '';
const url = 'http://localhost:3000';

console.log('─── Test start ───');
console.log('URL:', url);
console.log('Token:', token.slice(0, 30) + '...');

const socket = io(url, {
  auth: { token },
  // NO transports option — let socket.io negotiate
  reconnection: false,
  timeout: 10000,
});

socket.io.on('error', (err) => console.log('IO ERROR:', err.message));
socket.io.on('reconnect_attempt', (n) => console.log('Reconnect attempt', n));

socket.on('connect', () => {
  console.log('✅ CONNECTED id=' + socket.id);
  console.log('Transport:', socket.io.engine.transport.name);
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1500);
});

socket.on('connect_error', (err) => {
  console.log('❌ CONNECT_ERROR:', err.message);
  console.log('  Description:', err.description || '(none)');
  console.log('  Context:', err.context || '(none)');
  process.exit(1);
});

socket.on('auth:error', (data) => {
  console.log('❌ AUTH_ERROR:', data.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  if (reason !== 'io client disconnect') {
    process.exit(1);
  }
});

setTimeout(() => {
  console.log('❌ TIMEOUT — no connect after 10s');
  process.exit(1);
}, 12000);
