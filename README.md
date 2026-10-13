# PANDA Spec — Shared Envelope Format & Test Vectors

This repository contains the canonical specification and cross-language test vectors for the **PANDA (Private And Secure Data Access)** SDK.

## Contents

| File | Purpose |
|---|---|
| `envelope-format.md` | Normative envelope v1 wire-format specification |
| `blind-index-format.md` | Normative blind index specification — normalisation modes and encoding |
| `vectors/vectors.json` | Envelope and blind index vectors, consumed by all four language repos |
| `vectors/vectors.schema.json` | JSON Schema for vector structure — written but not yet enforced by anything |
| `verify_interop.js` | Cross-language interoperability verification script |

The vectors cover the envelope and the blind index.

The blind index ones matter more than they look. Four implementations were
agreeing on that format when the vectors were added — but by coincidence, not
because anything checked. Four separate divergences had already been found by
hand: the encoding, the normalisation mode the service applied, PHP's
ASCII-only `trim`, and PHP's ASCII-only `strtolower`. The harness catches all
four. Restoring PHP's old `trim` fails exactly three vectors, and nothing else.

The schema is not enforced by anything yet; see the note inside it.

## Versioning

This repo is tagged (`vN`) only when the spec or vector set changes, independent of any language SDK release cadence. Language repos (`panda-php`, `panda-node`, `panda-go`) pin to a specific tagged commit of this repo.

## Running the Interop Check

```bash
node verify_interop.js
```

Requires: Node.js ≥ 18, PHP ≥ 8.1 with ext-openssl, Go ≥ 1.20, and Python ≥ 3.10. All four language repos must be siblings in the same parent directory.
