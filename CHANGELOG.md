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

## Not yet tagged

There are no tags. Every SDK currently vendors an untagged commit, so there is
nothing to pin to and no way to say which spec revision an SDK implements.

The first tag should be `v1`, marking the envelope format as it now stands —
and the blind index encoding, which was specified long after four
implementations had already agreed on it by coincidence.

## What is specified

| Document | Status |
|---|---|
| `envelope-format.md` | Normative. Envelope v1 wire format. |
| `blind-index-format.md` | Normative. Normalisation modes and encoding. |
| `vectors/vectors.json` | Envelope vectors (positive, negative) and blind index vectors. |

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
