# Changelog

## Read this before creating a tag

This repository is versioned differently from the SDKs, and the difference is
the whole point of it.

**A tag here marks a change to the specification, not a release of software.**
The README says it: this repository is tagged only when the spec or the vector
set changes, on its own cadence, independent of any SDK release.

That makes a tag here a statement that four other repositories have to comply
with, so:

- Tag **only** when `envelope-format.md`, `blind-index-format.md`, or the
  vectors actually change. A tag on a documentation tidy-up tells every SDK
  there is something to conform to when there is not.
- Tag with a `v` prefix and a whole number: `v1`, `v2` — the README's
  convention, not semantic versioning. The SDKs pin to a tagged commit.
- After tagging, each SDK that vendors this repository needs its submodule
  pointer moved. A spec tag nobody adopts is worse than no tag: it looks like
  agreement that does not exist.

## Tagged

| Tag | Commit | What it marks |
|---|---|---|
| `v2` | `6157937` | The access token format, and the ninth interop section that enforces it across all four SDKs. |
| `v1` | `a376ee1` | The envelope format and the blind index encoding, as they stand. |

`v1` was the first tag, created after the blind index vectors landed, and it
was adopted by all four SDK submodule pins.

`v2` adds `token-format.md` and 26 token vectors, taking the interop run from
136 checks to 152. **An SDK pinning `v1` implements the envelope and blind
index rules only; an SDK pinning `v2` conforms to the token rule as well.**
All four pins moved to `v2` on the day it was cut.

## What is specified

| Document | Status |
|---|---|
| `envelope-format.md` | Normative. Envelope v1 wire format. |
| `blind-index-format.md` | Normative. Normalisation modes and encoding. |
| `token-format.md` | Normative. The access token format and the portal gate. |
| `vectors/vectors.json` | Envelope vectors (positive, negative), blind index vectors, and token format vectors. |

## The blind index is now enforced

The blind index had no vectors, so its specification was enforced by nothing
but care. Four implementations were agreeing on it — by coincidence rather
than by following the document, which did not exist at the time.

There are now eight vectors, covering each normalisation mode and, more
usefully, the cases where implementations actually diverged: a trailing
non-breaking space, non-ASCII letters, an ideographic space, and the NIK rule
collapsing a value with no digits to the empty string.

Each vector carries the `normalized` value alongside the expected index. When
two implementations disagree, the useful question is not "which index is
right" but "what did you hash", and an index alone never answers it.

`verify_interop.js` runs all eight against all four implementations: 32 checks.
Restoring PHP's old `trim` and `strtolower` fails exactly three of them, which
is the point — those three were a real defect that shipped, and nothing
noticed for a week.

Each language reads the vectors from a file rather than receiving them as
arguments. Several values contain characters that do not survive shell
quoting, and a harness that mangled them would report a failure in the
implementation rather than in itself.

## The access token format is now specified

The token format was the same defect as the blind index, one week later, and
the fifth instance of it in this project: **a shared rule with no single
definition.**

It was written out in four implementations, a CLI wizard, `CLAUDE.md`, and two
documentation pages. Three of the four implementations agreed; `panda-py`
accepted 48 hex characters where the others accepted 48 or 64, so a token that
the project considers valid had exactly one implementation that refused it.
Nobody had written the rule down, so no copy could be called the wrong one —
including the one that was.

Worse, the copies were tested by copying: two test files compiled their own
regexp with the pattern written out again, so they asserted a copy against
itself and would have gone on passing after `TOKEN_PATTERN` changed. One of
them was in the Go CLI test and proved nothing about the CLI.

`token-format.md` now defines it, and 22 vectors in `vectors.json` pin what is
accepted and what is rejected — 88 cross-language checks, run by the same
section-per-implementation machinery as the blind index. Restoring `panda-py`'s
old 48-only pattern fails exactly two of them.

The vectors cover the shape of a token and nothing else. Whether a token is
*valid* is a question for the live portal, and an offline vector that claimed
to answer it would be a lie with a checkmark next to it — so the portal's
presence per implementation is recorded by hand in `token-format.md` instead,
where it is visibly a claim someone wrote rather than a test that ran.

That hand-written table is how `panda-py`'s missing portal validation came to
light: it does not call the portal at all, so any well-formed token — revoked,
already activated, or invented — initialises successfully there while the
other three refuse. It is recorded as a known deviation and is not fixed.

## What the status table turned up

Two of the four entries in `token-format.md`'s portal column started out wrong,
and neither was found by reading the table. Both were found by filling it in.

**`panda-py` performed no portal validation.** It checked the format and
proceeded, so a revoked token, one already activated, and one never issued all
initialised successfully. Describing the column meant deciding what to write
for each row, and there was nothing to write. It now calls the portal.

**Three of the four read `{"valid": "false"}` as approval.** Found while
writing the tests that the fixed column made necessary. `if (!result.valid)`,
`if (!$result['valid'])` and `if not result["valid"]` all treat a non-empty
string as true, so a response explicitly saying the token is not valid was read
as consent and a key was generated. `panda-go` refused it — decoding a JSON
string into a Go `bool` fails — so one implementation disagreed with the
other three, and it was the one that was right.

That second one is worse than the first and neither is visible in a vector.
The rule is now stated: only the JSON boolean `true` is consent.

**`panda-php`'s portal call had never executed.** It referenced
`CURLOPT_CONNECT_TIMEOUT`, a constant that does not exist; the real name is
`CURLOPT_CONNECTTIMEOUT`. On PHP 8 that is a fatal error, so the call threw
before opening a connection. The same defect class as everything else here: a
code path nothing had ever entered.

## Two engines spell the end of a string differently

The pattern is anchored with `$`, and in Python and PCRE `$` also matches
immediately before a newline at the end of the subject. So
`panda_live_<48 hex>\n` was a valid token in `panda-py` and `panda-php` and
invalid in `panda-node` and `panda-go` — the same bytes, two answers.

Python needs `\Z`; PCRE needs the `D` modifier. Four vectors now cover a
trailing LF, CR and CRLF and a leading newline. Reverting either fix fails
exactly two of the 152 checks, and no others.

This is the case a single pattern string cannot express, which is why the
vector file carries a `patternNote` alongside it.
