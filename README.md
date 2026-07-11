# PANDA Spec — Shared Envelope Format & Test Vectors

This repository contains the canonical specification and cross-language test vectors for the **PANDA (Private And Secure Data Access)** SDK.

## Contents

| File | Purpose |
|---|---|
| `envelope-format.md` | Normative envelope v1 wire-format specification |
| `vectors/vectors.json` | Shared positive + negative test vectors consumed by all three language repos |
| `vectors/vectors.schema.json` | JSON Schema validating vector structure |
| `verify_interop.js` | Cross-language interoperability verification script |

## Versioning

This repo is tagged (`vN`) only when the spec or vector set changes, independent of any language SDK release cadence. Language repos (`panda-php`, `panda-node`, `panda-go`) pin to a specific tagged commit of this repo.

## Running the Interop Check

```bash
node verify_interop.js
```

Requires: Node.js ≥ 18, PHP ≥ 8.1 with ext-openssl, Go ≥ 1.20. All three language repos must be siblings in the same parent directory.
