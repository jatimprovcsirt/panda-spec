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
| `vectors/vectors.json` | Envelope test vectors — positive and negative cases. |

The blind index has **no vectors**, so its specification is enforced by nothing
but care. Four implementations agree on it today; that agreement is not
mechanically checked, and it was reached by accident rather than by following
the document, which did not exist at the time.
