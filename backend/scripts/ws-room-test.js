const { io } = require('socket.io-client');
const [, , custToken, adminToken, otherToken, ticketId, ticket2Id] = process.argv;
const URL = 'http://localhost:3000';

function mkSocket(token) {
  return io(URL, { auth: { token }, reconnection: false, timeout: 8000 });
}

async function waitConnect(sock, name) {
  return new Promise((res, rej) => {
    sock.on('connect', () => res());
    sock.on('connect_error', (e) => rej(new Error(name + ': ' + e.message)));
    setTimeout(() => rej(new Error(name + ': timeout')), 9000);
  });
}

(async () => {
  const cust = mkSocket(custToken);
  const admin = mkSocket(adminToken);
  const other = mkSocket(otherToken);

  try {
    await Promise.all([
      waitConnect(cust, 'cust'),
      waitConnect(admin, 'admin'),
      waitConnect(other, 'other'),
    ]);
    console.log('ALL_CONNECTED');

    // ① customer joins ticket room
    const joinRes = await new Promise((res) => {
      cust.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('CUST_JOIN=' + JSON.stringify(joinRes));

    // ② admin joins same room
    const joinRes2 = await new Promise((res) => {
      admin.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('ADMIN_JOIN=' + JSON.stringify(joinRes2));

    // ③ other user (no access) tries to join ticket 2 (own ticket)
    const otherJoin = await new Promise((res) => {
      other.emit('support:join', { ticketId: ticket2Id }, (r) => res(r));
    });
    console.log('OTHER_JOIN_OWN=' + JSON.stringify(otherJoin));

    // ④ other user tries to join customer's ticket 1 → should deny
    const denyJoin = await new Promise((res) => {
      other.emit('support:join', { ticketId }, (r) => res(r));
    });
    console.log('OTHER_JOIN_OTHER=' + JSON.stringify(denyJoin));

    // ⑤ leave
    const leaveRes = await new Promise((res) => {
      cust.emit('support:leave', { ticketId }, (r) => res(r));
    });
    console.log('CUST_LEAVE=' + JSON.stringify(leaveRes));

    cust.disconnect();
    admin.disconnect();
    other.disconnect();
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.log('ERROR=' + err.message);
    cust.disconnect();
    admin.disconnect();
    other.disconnect();
    process.exit(1);
  }
})();
