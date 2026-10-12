const { io } = require('socket.io-client');
const [, , custToken, adminToken, ticketId] = process.argv;
const URL = 'http://localhost:3000';

function mk(t) { return io(URL, { auth: { token: t }, reconnection: false, timeout: 8000 }); }
async function wait(s, n) {
  return new Promise((res, rej) => {
    s.on('connect', res);
    s.on('connect_error', (e) => rej(new Error(n + ': ' + e.message)));
    setTimeout(() => rej(new Error(n + ': timeout')), 9000);
  });
}

(async () => {
  const cust = mk(custToken);
  const admin = mk(adminToken);

  try {
    await Promise.all([wait(cust, 'cust'), wait(admin, 'admin')]);
    console.log('CONNECTED');

    // Admin joins room first (to receive)
    const adminJoin = await new Promise((r) => {
      admin.emit('support:join', { ticketId }, r);
    });
    console.log('ADMIN_JOIN=' + JSON.stringify(adminJoin));

    // Customer joins room
    const custJoin = await new Promise((r) => {
      cust.emit('support:join', { ticketId }, r);
    });
    console.log('CUST_JOIN=' + JSON.stringify(custJoin));

    // Admin listens for message:new
    const received = new Promise((res) => {
      admin.on('message:new', (d) => res(d));
      setTimeout(() => res(null), 5000);
    });

    // Customer sends message
    const sendAck = await new Promise((r) => {
      cust.emit('message:send', { ticketId, body: 'Hello from customer!' }, r);
    });
    console.log('SEND_ACK=' + JSON.stringify(sendAck));

    // Admin receives?
    const msg = await received;
    if (msg && msg.message && msg.message.body === 'Hello from customer!') {
      console.log('ADMIN_RECEIVED=' + JSON.stringify({ body: msg.message.body, role: msg.message.senderRole }));
    } else {
      console.log('ADMIN_RECEIVED=null');
    }

    // History
    const history = await new Promise((r) => {
      cust.emit('message:history', { ticketId, page: 1, limit: 10 }, r);
    });
    console.log('HISTORY=' + JSON.stringify(history));

    // Unauthorized send (unjoin + use wrong user? just check admin sends with internal flag)
    // Admin sends internal note (should work, staff-only)
    const internalAck = await new Promise((r) => {
      admin.emit('message:send', { ticketId, body: 'Internal only', isInternal: true }, r);
    });
    console.log('INTERNAL_SEND=' + JSON.stringify(internalAck));

    cust.disconnect();
    admin.disconnect();
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.log('ERROR=' + err.message);
    cust.disconnect();
    admin.disconnect();
    process.exit(1);
  }
})();
