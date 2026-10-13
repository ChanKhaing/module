#!/bin/bash
cd ~/Desktop/nodeJob/module/backend || exit 1

G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; B="\033[0;34m"; N="\033[0m"
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); echo -e "${G}  ✅ $1${N}"; }
no()   { FAIL=$((FAIL+1)); echo -e "${R}  ❌ $1${N}"; }
info() { echo -e "${Y}  ℹ️  $1${N}"; }

echo -e "${B}════════════════════════════════════════${N}"
echo -e "${B}  PJ-11 Commit 1 — Verify (Storage)${N}"
echo -e "${B}════════════════════════════════════════${N}"

echo ""
echo "▶ ① Files"
for f in \
  src/infra/minio/storage.interface.ts \
  src/infra/minio/minio.service.ts \
  src/infra/minio/storage.module.ts \
  src/infra/minio/index.ts; do
  [ -f "$f" ] && ok "$(basename $f)" || no "Missing: $f"
done

echo ""
echo "▶ ② StorageModule registered"
grep -q "StorageModule" src/app.module.ts \
  && ok "Registered" || no "Not registered"

echo ""
echo "▶ ③ MinIO container"
if docker ps --format "{{.Names}}" | grep -q "^ticket-minio$"; then
  ok "ticket-minio running"
else
  no "ticket-minio not running"
fi

echo ""
echo "▶ ④ MinIO health"
curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live \
  | grep -q "200" && ok "MinIO reachable" || no "MinIO not reachable"

echo ""
echo "▶ ⑤ Build"
npm run build > /tmp/pj11-c1-build.log 2>&1 \
  && ok "Build passes" || (no "Build failed"; tail -10 /tmp/pj11-c1-build.log; exit 1)

echo ""
echo "▶ ⑥ Live test — upload + presigned + delete"

cat > scripts/minio-smoke.js << 'JSEOF'
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
JSEOF

RESULT=$(node scripts/minio-smoke.js 2>&1)
echo "$RESULT" | sed 's/^/  /'

echo "$RESULT" | grep -q "UPLOAD_OK" && ok "Upload works" || no "Upload failed"
echo "$RESULT" | grep -q "STAT_SIZE=17" && ok "Stat size correct" || no "Stat size mismatch"
echo "$RESULT" | grep -q "PRESIGNED_OK=true" && ok "Presigned works" || no "Presigned failed"
echo "$RESULT" | grep -q "DELETE_OK" && ok "Delete works" || no "Delete failed"

echo ""
echo -e "${B}════════════════════════════════════════${N}"
echo -e "${G}  ✅ PASS: $PASS${N}"
[ $FAIL -gt 0 ] && echo -e "${R}  ❌ FAIL: $FAIL${N}" || echo -e "${G}  ❌ FAIL: 0${N}"
echo -e "${B}════════════════════════════════════════${N}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
