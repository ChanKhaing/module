const { io } = require('socket.io-client');
const [, , custToken, adminToken, ticketId, custId, adminId] = process.argv;
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

    await new Promise((r) => cust.emit('support:join', { ticketId }, r));
    await new Promise((r) => admin.emit('support:join', { ticketId }, r));
    console.log('JOINED');

    // ① typing:start (cust) → admin receives
    const typingPromise = new Promise((res) => {
      admin.on('typing', (d) => res(d));
      setTimeout(() => res(null), 4000);
    });
    await new Promise((r) => cust.emit('typing:start', { ticketId }, r));
    const typing = await typingPromise;
    if (typing && typing.isTyping === true && typing.userId === custId) {
      console.log('TYPING_OK=' + JSON.stringify({ isTyping: typing.isTyping, role: typing.role }));
    } else {
      console.log('TYPING_FAIL=' + JSON.stringify(typing));
    }

    // ② typing:stop
    const typingStopPromise = new Promise((res) => {
      admin.once('typing', (d) => res(d));
      setTimeout(() => res(null), 4000);
    });
    await new Promise((r) => cust.emit('typing:stop', { ticketId }, r));
    const typingStop = await typingStopPromise;
    console.log('TYPING_STOP=' + JSON.stringify(typingStop));

    // ③ message send (admin) — so customer has unread
    await new Promise((r) => admin.emit('message:send', { ticketId, body: 'Reply from admin' }, r));

    // ④ customer marks read
    const readAck = await new Promise((r) => cust.emit('message:read', { ticketId }, r));
    console.log('READ_ACK=' + JSON.stringify(readAck));

    // ⑤ presence:check
    const presence = await new Promise((r) => {
      cust.emit('presence:check', { userIds: [adminId, custId, '000000000000000000000000'] }, r);
    });
    console.log('PRESENCE=' + JSON.stringify(presence));

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
