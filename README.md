# PANDA Spec — Shared Envelope Format & Test Vectors

This repository contains the canonical specification and cross-language test vectors for the **PANDA (Private And Secure Data Access)** SDK.

## Contents

| File | Purpose |
|---|---|
| `envelope-format.md` | Normative envelope v1 wire-format specification |
| `blind-index-format.md` | Normative blind index specification — normalisation modes and encoding |
| `token-format.md` | Normative access token format, and what the init-time portal gate must do |
| `vectors/vectors.json` | Envelope, blind index, and token format vectors, consumed by all four language repos |
| `vectors/vectors.schema.json` | JSON Schema for vector structure — written but not yet enforced by anything |
| `verify_interop.js` | Cross-language interoperability verification script |

The vectors cover the envelope, the blind index, and the token format.

The blind index ones matter more than they look. Four implementations were
agreeing on that format when the vectors were added — but by coincidence, not
because anything checked. Four separate divergences had already been found by
hand: the encoding, the normalisation mode the service applied, PHP's
ASCII-only `trim`, and PHP's ASCII-only `strtolower`. The harness catches all
four. Restoring PHP's old `trim` fails exactly three vectors, and nothing else.

The token format vectors exist for the same reason, one week later. The pattern
was written out in four implementations, a CLI wizard, `CLAUDE.md`, and two
documentation pages; three of the four implementations agreed, and `panda-py`
accepted 48 hex characters where the rest accepted 48 or 64. Restoring that
pattern now fails exactly two checks.

They cover the *shape* of a token and nothing else. Whether a token is valid is
a question for the live portal, and nothing offline can answer it — so
`token-format.md` records which implementations call the portal, by hand, where
it is visibly a claim rather than a test. That table is how `panda-py`'s
missing portal call came to light.

The schema is not enforced by anything yet; see the note inside it.

## Versioning

This repo is tagged (`vN`) only when the spec or vector set changes, independent of any language SDK release cadence. All four language repos (`panda-php`, `panda-node`, `panda-go`, `panda-py`) vendor this repository as a submodule pinned to a specific tagged commit.

`v1` is the current tag. It does not include `token-format.md` or the token vectors, which landed after it — an SDK pinning `v1` conforms to the envelope and blind index rules but predates the token rule. The next tag is `v2`.

## Running the Interop Check

```bash
node verify_interop.js
```

Requires: Node.js ≥ 18, PHP ≥ 8.1 with ext-openssl, Go ≥ 1.20, and Python ≥ 3.10. All four language repos must be siblings in the same parent directory.

## Licence

Apache License 2.0 — see `LICENSE` for the full text and `NOTICE` for
attribution.

Previously this repository had no licence file at all, which for a document
four SDKs are required to conform to is worse than it sounds: the normative
documents were being redistributed with no statement of what anyone was
allowed to do with them.
