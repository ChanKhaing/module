const { io } = require('socket.io-client');
const token = process.argv[2];
const ticketId = process.argv[3];

const s = io('http://localhost:3000', {
  auth: { token },
  reconnection: false,
  timeout: 8000,
});

s.on('connect', () => {
  console.log('CONNECTED', s.id);
  console.log('Emitting support:join with ticketId=' + ticketId);

  s.emit('support:join', { ticketId }, (resp) => {
    console.log('ACK:', JSON.stringify(resp));
    s.disconnect();
    setTimeout(() => process.exit(0), 300);
  });

  setTimeout(() => {
    console.log('NO ACK AFTER 6s — handler not responding');
    s.disconnect();
    process.exit(1);
  }, 6000);
});

s.on('support:joined', (d) => console.log('EVENT support:joined:', JSON.stringify(d)));
s.on('support:error', (d) => console.log('EVENT support:error:', JSON.stringify(d)));
s.on('connect_error', (e) => { console.log('CONNECT_ERROR:', e.message); process.exit(1); });
s.on('auth:error', (d) => { console.log('AUTH_ERROR:', JSON.stringify(d)); process.exit(1); });
