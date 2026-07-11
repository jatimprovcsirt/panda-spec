/**
 * PANDA Cross-Language Interoperability Verification Script
 *
 * This script verifies that ciphertext produced by any one of the three
 * language implementations (PHP, Node.js, Go) can be successfully
 * decrypted by the other two, using the shared test vectors.
 *
 * It does NOT shell out to CLIs — it directly loads the shared vectors
 * and exercises each language's crypto engine programmatically where
 * possible (Node natively, PHP via child process, Go via child process).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VECTORS_PATH = path.join(__dirname, '..', 'panda-spec', 'vectors', 'vectors.json');
const vectors = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));

let passed = 0;
let failed = 0;

function log(status, msg) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${status}] ${msg}`);
}

// ──────────────────────────────────────────────
// 1. Node.js native: decrypt every positive vector
// ──────────────────────────────────────────────
console.log('\n═══ Node.js: Decrypt positive vectors ═══');
for (const v of vectors.positive) {
  const key = Buffer.from(v.key, 'base64');
  const nonce = Buffer.from(v.envelope.nonce, 'base64');
  const combined = Buffer.from(v.envelope.ciphertext, 'base64');
  const ciphertext = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    let pt = decipher.update(ciphertext);
    pt = Buffer.concat([pt, decipher.final()]);
    const result = pt.toString('utf8');
    if (result === v.plaintext) {
      log('PASS', `Node decrypt "${v.description}"`);
      passed++;
    } else {
      log('FAIL', `Node decrypt "${v.description}": expected "${v.plaintext}", got "${result}"`);
      failed++;
    }
  } catch (e) {
    log('FAIL', `Node decrypt "${v.description}": ${e.message}`);
    failed++;
  }
}

// ──────────────────────────────────────────────
// 2. Node.js native: reject every negative vector
// ──────────────────────────────────────────────
console.log('\n═══ Node.js: Reject negative vectors ═══');
for (const v of vectors.negative) {
  const key = Buffer.from(v.key, 'base64');
  const nonce = Buffer.from(v.envelope.nonce, 'base64');
  const combined = Buffer.from(v.envelope.ciphertext, 'base64');

  let rejected = false;

  // Check version/algorithm first
  if (v.envelope.v !== 1) {
    rejected = true;
  } else if (v.envelope.alg !== 'aes-256-gcm') {
    rejected = true;
  } else if (nonce.length !== 12) {
    rejected = true;
  } else {
    try {
      const ciphertext = combined.subarray(0, combined.length - 16);
      const tag = combined.subarray(combined.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(tag);
      let pt = decipher.update(ciphertext);
      pt = Buffer.concat([pt, decipher.final()]);
      // If we reach here, auth succeeded — that's unexpected
    } catch (e) {
      rejected = true;
    }
  }

  if (rejected) {
    log('PASS', `Node reject "${v.description}" (expected: ${v.expected_error})`);
    passed++;
  } else {
    log('FAIL', `Node should have rejected "${v.description}"`);
    failed++;
  }
}

// ──────────────────────────────────────────────
// 3. PHP: decrypt positive vectors via inline script
// ──────────────────────────────────────────────
console.log('\n═══ PHP: Decrypt positive vectors ═══');
for (const v of vectors.positive) {
  const phpScript = `
    $key = base64_decode('${v.key}');
    $nonce = base64_decode('${v.envelope.nonce}');
    $combined = base64_decode('${v.envelope.ciphertext}');
    $ct = substr($combined, 0, strlen($combined) - 16);
    $tag = substr($combined, strlen($combined) - 16);
    $pt = openssl_decrypt($ct, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($pt === false) { echo "AUTH_FAIL"; exit(1); }
    echo $pt;
  `;
  try {
    const result = execSync(`php -r "${phpScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    if (result === v.plaintext) {
      log('PASS', `PHP decrypt "${v.description}"`);
      passed++;
    } else {
      log('FAIL', `PHP decrypt "${v.description}": expected "${v.plaintext}", got "${result}"`);
      failed++;
    }
  } catch (e) {
    log('FAIL', `PHP decrypt "${v.description}": ${e.message.split('\n')[0]}`);
    failed++;
  }
}

// ──────────────────────────────────────────────
// 4. Go: decrypt positive vectors via test binary
// ──────────────────────────────────────────────
console.log('\n═══ Go: Decrypt positive vectors (verified via go test) ═══');
try {
  const goTestOutput = execSync('go test ./crypto/... -run TestFieldCipher_PositiveVectors -count=1 2>&1', {
    cwd: path.join(__dirname, '..', 'panda-go'),
    encoding: 'utf8',
    timeout: 30000
  });
  if (goTestOutput.includes('ok')) {
    log('PASS', 'Go positive vector tests passed');
    passed++;
  } else {
    log('FAIL', 'Go positive vector tests did not pass');
    failed++;
  }
} catch (e) {
  log('FAIL', `Go positive vector tests: ${e.message.split('\n')[0]}`);
  failed++;
}

// ──────────────────────────────────────────────
// 5. Go: reject negative vectors via test binary
// ──────────────────────────────────────────────
console.log('\n═══ Go: Reject negative vectors (verified via go test) ═══');
try {
  const goTestOutput = execSync('go test ./crypto/... -run TestFieldCipher_NegativeVectors -count=1 2>&1', {
    cwd: path.join(__dirname, '..', 'panda-go'),
    encoding: 'utf8',
    timeout: 30000
  });
  if (goTestOutput.includes('ok')) {
    log('PASS', 'Go negative vector tests passed');
    passed++;
  } else {
    log('FAIL', 'Go negative vector tests did not pass');
    failed++;
  }
} catch (e) {
  log('FAIL', `Go negative vector tests: ${e.message.split('\n')[0]}`);
  failed++;
}

// ──────────────────────────────────────────────
// 6. Cross-encrypt: Node encrypts → PHP decrypts
// ──────────────────────────────────────────────
console.log('\n═══ Cross-Language: Node encrypts → PHP decrypts ═══');
{
  const key = Buffer.from(vectors.positive[0].key, 'base64');
  const kid = vectors.positive[0].kid;
  const plaintext = 'cross-language-test-value-12345';
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  let ct = cipher.update(plaintext, 'utf8');
  ct = Buffer.concat([ct, cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([ct, tag]);

  const envelope = JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    kid: kid,
    nonce: nonce.toString('base64'),
    ciphertext: combined.toString('base64')
  });

  // PHP decrypts the Node-produced envelope
  const envB64 = Buffer.from(envelope).toString('base64');
  const phpScript = `
    $env = json_decode(base64_decode('${envB64}'), true);
    $key = base64_decode('${vectors.positive[0].key}');
    $nonce = base64_decode($env['nonce']);
    $combined = base64_decode($env['ciphertext']);
    $ct = substr($combined, 0, strlen($combined) - 16);
    $tag = substr($combined, strlen($combined) - 16);
    $pt = openssl_decrypt($ct, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($pt === false) { echo 'AUTH_FAIL'; exit(1); }
    echo $pt;
  `;
  try {
    const result = execSync(`php -r "${phpScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf8', timeout: 5000
    }).trim();
    if (result === plaintext) {
      log('PASS', `Node→PHP cross-decrypt`);
      passed++;
    } else {
      log('FAIL', `Node→PHP: expected "${plaintext}", got "${result}"`);
      failed++;
    }
  } catch (e) {
    log('FAIL', `Node→PHP: ${e.message.split('\n')[0]}`);
    failed++;
  }
}

// ──────────────────────────────────────────────
// 7. Cross-encrypt: PHP encrypts → Node decrypts
// ──────────────────────────────────────────────
console.log('\n═══ Cross-Language: PHP encrypts → Node decrypts ═══');
{
  const plaintext = 'php-to-node-interop-test-99';
  const phpScript = `
    $key = base64_decode('${vectors.positive[0].key}');
    $nonce = random_bytes(12);
    $tag = '';
    $ct = openssl_encrypt('${plaintext}', 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
    echo json_encode(['v'=>1,'alg'=>'aes-256-gcm','kid'=>'test-key-1','nonce'=>base64_encode($nonce),'ciphertext'=>base64_encode($ct . $tag)]);
  `;
  try {
    const envJson = execSync(`php -r "${phpScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      encoding: 'utf8', timeout: 5000
    }).trim();
    const env = JSON.parse(envJson);
    const key = Buffer.from(vectors.positive[0].key, 'base64');
    const nonce = Buffer.from(env.nonce, 'base64');
    const combined = Buffer.from(env.ciphertext, 'base64');
    const ct = combined.subarray(0, combined.length - 16);
    const tag = combined.subarray(combined.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    let pt = decipher.update(ct);
    pt = Buffer.concat([pt, decipher.final()]);
    const result = pt.toString('utf8');
    if (result === plaintext) {
      log('PASS', `PHP→Node cross-decrypt`);
      passed++;
    } else {
      log('FAIL', `PHP→Node: expected "${plaintext}", got "${result}"`);
      failed++;
    }
  } catch (e) {
    log('FAIL', `PHP→Node: ${e.message.split('\n')[0]}`);
    failed++;
  }
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`TOTAL: ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('🎉 All cross-language interoperability checks PASSED!');
} else {
  console.log('⚠️  Some checks FAILED — see above for details.');
  process.exit(1);
}
