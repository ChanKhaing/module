const { Client } = require('minio');
const c = new Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin',
});

(async () => {
  const bucket = 'test-pj11';
  const key = `smoke-${Date.now()}.txt`;

  try {
    // ensure bucket
    const exists = await c.bucketExists(bucket).catch(() => false);
    if (!exists) await c.makeBucket(bucket);

    // upload
    const buf = Buffer.from('Hello MinIO PJ-11');
    await c.putObject(bucket, key, buf, buf.length, { 'Content-Type': 'text/plain' });
    console.log('UPLOAD_OK');

    // stat
    const stat = await c.statObject(bucket, key);
    console.log('STAT_SIZE=' + stat.size);

    // presigned
    const url = await c.presignedGetObject(bucket, key, 900);
    console.log('PRESIGNED_OK=' + (url.startsWith('http')));

    // delete
    await c.removeObject(bucket, key);
    console.log('DELETE_OK');
  } catch (err) {
    console.log('ERROR=' + err.message);
    process.exit(1);
  }
})();
