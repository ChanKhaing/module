const { io } = require('socket.io-client');
const [, , token, userId] = process.argv;
const URL = 'http://localhost:3000';

const s = io(URL, { auth: { token }, reconnection: false, timeout: 8000 });

let received = false;

s.on('connect', async () => {
  console.log('CONNECTED id=' + s.id);
  console.log('USER_ID=' + userId);

  // Wait for notification:new
  s.on('notification:new', (data) => {
    received = true;
    console.log('NOTIFICATION_NEW=' + JSON.stringify({
      title: data.title,
      type: data.type,
      isRead: data.isRead,
    }));
  });

  // Trigger server-side via DB insert → won't trigger create()
  // Better: give test 3s
  setTimeout(() => {
    console.log(received ? 'RECEIVED_OK' : 'NOT_RECEIVED');
    s.disconnect();
    process.exit(received ? 0 : 1);
  }, 4000);
});

s.on('connect_error', (e) => { console.log('ERROR=' + e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 10000);
