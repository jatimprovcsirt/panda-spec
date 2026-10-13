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
const os = require('os');
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
// 8. Blind index: every implementation, every vector
// ──────────────────────────────────────────────
//
// This is the section that makes the four implementations' agreement a fact
// rather than a hope. They were already agreeing when this was written — but
// by coincidence, not because anything checked. Four separate divergences had
// been found by hand before it: the encoding, the normalisation mode the
// service applied, PHP's ASCII-only trim, and PHP's ASCII-only strtolower.
// Every one of them would have been caught here on the first run.
//
// Each language reads the vectors from a file rather than receiving the
// values as arguments. Several contain a non-breaking space, an ideographic
// space, and non-ASCII letters, and none of those survives a trip through
// shell quoting. A harness that mangled them would report a failure in the
// implementation rather than in itself — which is the more expensive kind of
// wrong.
console.log('\n═══ Blind index: all four implementations ═══');
{
  const bi = vectors.blindIndex;
  const root = path.join(__dirname, '..');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'panda-vectors-'));
  const dataFile = path.join(tmp, 'blindindex.json');
  fs.writeFileSync(
    dataFile,
    JSON.stringify({ key: bi.key, vectors: bi.vectors }),
    'utf8'
  );

  // Each runner prints "<position>\t<index>", one line per vector.
  //
  // Keyed by position rather than by description, because a description is
  // free text and these ones contain an em-dash. A subprocess whose stdout
  // is not UTF-8 mangles it, the key stops matching, and the harness reports
  // a failure in the implementation. It did exactly that on the first run.
  // Position is ASCII; nothing is left to mangle.
  fs.writeFileSync(
    path.join(tmp, 'runner.php'),
    `<?php
require ${JSON.stringify(path.join(root, 'panda-php', 'vendor', 'autoload.php'))};
$d = json_decode(file_get_contents($argv[1]), true);
$key = base64_decode($d['key']);
foreach ($d['vectors'] as $i => $v) {
    echo $i, "\\t", Panda\\BlindIndex\\BlindIndexer::generate($v['value'], $key, $v['normalization']), "\\n";
}
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(tmp, 'runner.py'),
    `import json, sys
from panda.blind_index.blind_index import BlindIndexer

with open(sys.argv[1], encoding="utf-8") as f:
    d = json.load(f)

key = __import__("base64").b64decode(d["key"])
for i, v in enumerate(d["vectors"]):
    print(i, BlindIndexer.generate(v["value"], key, v["normalization"]), sep="\\t")
`,
    'utf8'
  );

  // Go needs a module for the import to resolve, so its runner goes inside
  // the repository and is removed afterwards.
  const goDir = path.join(root, 'panda-go', '.vectorcheck');
  fs.mkdirSync(goDir, { recursive: true });
  fs.writeFileSync(
    path.join(goDir, 'main.go'),
    `package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/jatimprovcsirt/panda-go/blindindex"
)

func main() {
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	var d struct {
		Key     string \`json:"key"\`
		Vectors []struct {
			Description   string \`json:"description"\`
			Value         string \`json:"value"\`
			Normalization string \`json:"normalization"\`
		} \`json:"vectors"\`
	}
	if err := json.Unmarshal(raw, &d); err != nil {
		panic(err)
	}
	key, err := base64Decode(d.Key)
	if err != nil {
		panic(err)
	}
	for i, v := range d.Vectors {
		fmt.Printf("%d\\t%s\\n", i, blindindex.Generate(v.Value, key, v.Normalization))
	}
}
`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(goDir, 'b64.go'),
    `package main

import "encoding/base64"

func base64Decode(s string) ([]byte, error) { return base64.StdEncoding.DecodeString(s) }
`,
    'utf8'
  );

  // Written to a file like the others, rather than passed to `node -e`.
  // Shell quoting is where the bugs are, and this repository has already
  // produced one harness that reported a pass it had not earned.
  fs.writeFileSync(
    path.join(tmp, 'runner.js'),
    `const fs = require('fs');
const { BlindIndexer } = require(${JSON.stringify(path.join(root, 'panda-node', 'dist', 'index.js'))});

const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const key = Buffer.from(d.key, 'base64');
d.vectors.forEach((v, i) => {
  console.log(i + '\\t' + BlindIndexer.generate(v.value, key, v.normalization));
});
`,
    'utf8'
  );

  const runners = [
    {
      name: 'panda-node',
      command: `node ${JSON.stringify(path.join(tmp, 'runner.js'))} ${JSON.stringify(dataFile)}`,
    },
    { name: 'panda-php', command: `php ${JSON.stringify(path.join(tmp, 'runner.php'))} ${JSON.stringify(dataFile)}` },
    {
      name: 'panda-py',
      command: `python ${JSON.stringify(path.join(tmp, 'runner.py'))} ${JSON.stringify(dataFile)}`,
      env: {
        ...process.env,
        PYTHONPATH: path.join(root, 'panda-py', 'src'),
        // Python on Windows defaults stdout to the system codepage, which
        // cannot represent the values in these vectors. Only indexes cross
        // this boundary today, but the next person to print a value should
        // not have to rediscover why it arrived as question marks.
        PYTHONIOENCODING: 'utf-8',
      },
    },
    {
      name: 'panda-go',
      command: `go run ./.vectorcheck ${JSON.stringify(dataFile)}`,
      cwd: path.join(root, 'panda-go'),
    },
  ];

  try {
    for (const runner of runners) {
      let output;
      try {
        output = execSync(runner.command, {
          encoding: 'utf8',
          timeout: 60000,
          cwd: runner.cwd || __dirname,
          env: runner.env || process.env,
        });
      } catch (e) {
        log('FAIL', `${runner.name}: could not be run — ${String(e.message).split('\n')[0]}`);
        failed++;
        continue;
      }

      const produced = new Map();
      for (const line of output.split(/\r?\n/)) {
        const i = line.indexOf('\t');
        if (i > 0) produced.set(line.slice(0, i).trim(), line.slice(i + 1).trim());
      }

      for (const [position, v] of bi.vectors.entries()) {
        const got = produced.get(String(position));
        if (got === v.index) {
          log('PASS', `${runner.name}: ${v.description}`);
          passed++;
        } else {
          // The normalised value is in the message on purpose. When two
          // implementations disagree, "what did you hash" is the question
          // that answers it, and an index alone never does.
          log(
            'FAIL',
            `${runner.name}: ${v.description}\n` +
              `         expected ${v.index}\n` +
              `         got      ${got === undefined ? '(no output)' : got}\n` +
              `         ${JSON.stringify(v.value)} under "${v.normalization}" normalises to ${JSON.stringify(v.normalized)}`
          );
          failed++;
        }
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(goDir, { recursive: true, force: true });
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
