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


## Licence: MIT to Apache-2.0

Every repository now carries a verbatim Apache License 2.0 and a NOTICE file
naming the copyright holder. Four of the six had no licence file at all, and
`panda-node` had no `license` field in its manifest either — it declared
nothing while listing a `LICENSE` in `files` that did not exist, so what npm
actually published was unlicensed.

Apache-2.0 over MIT for one reason: an express patent grant. MIT is silent on
patents, and this is cryptographic software that other agencies and vendors are
expected to embed in their own systems — the grant, and the retaliation clause
that comes with it, is the part that matters when a third party deploys it.
Apache-2.0 is no less permissive, so nothing about adoption gets harder.

GPL was considered and rejected: copyleft would block exactly the cross-agency
adoption this project exists for, and sit badly with public procurement.

**What is already published does not change.** A licence cannot be altered
retroactively on an artifact that has been released, so panda-py 0.2.1-0.2.3 on
PyPI and panda-php 0.2.1-0.2.2 on Packagist stay MIT, panda-node 0.5.0 on npm
stays unlicensed, and the Go tags through v0.5.1 carry no licence text
either. This applies from the next release of each.

The `LICENSE` file is the canonical text byte-for-byte — verified against its
published SHA-256, `cfc7749b...523d30` — so it stays comparable to every other
copy of it.

## Tagged

| Tag | Commit | What it marks |
|---|---|---|
| `v4` | see the tag | `cli-flags.md`, and the tenth interop section that runs all four CLIs' `--help`. |
| `v2` | `6157937` | The access token format, and the ninth interop section that enforces it across all four SDKs. |
| `v1` | `a376ee1` | The envelope format and the blind index encoding, as they stand. |

`v1` was the first tag, created after the blind index vectors landed, and it
was adopted by all four SDK submodule pins.

`v2` adds `token-format.md` and 26 token vectors, taking the interop run from
136 checks to 152. **An SDK pinning `v1` implements the envelope and blind
index rules only; an SDK pinning `v2` conforms to the token rule as well.**
All four pins moved to `v2` on the day it was cut.

> The `v2` row above was written *after* the tag, not before it, so the tree at
> `v2` contains a version of this file that still describes `v2` as the next
> tag. The order is the wrong way round — a tag should point at a commit whose
> changelog already describes it — and the tag was not moved to correct it,
> because the rule two sections up says a documentation tidy-up must not carry
> a spec tag, and re-pointing a pushed tag is the operation that produced
> `panda-php`'s stray `v0.5.0`. Everything `v2` needs to say about the spec is
> in the tree at `v2`; only this table is one commit late.

> **`v4` is a lightweight tag; `v1`–`v3` are annotated.** That is a
> mistake, and it is recorded rather than corrected. The commit is the same
> either way and all four SDK pins resolve it identically, so nothing is
> broken — but `git describe` without `--tags` considers only annotated
> tags, so it reports `v3-2-g2f462fb` for a tree that is at `v4`. That is
> the string `git submodule status` prints, which is the command a maintainer
> runs to check the pin, and it says the pin is two commits past the previous
> spec version rather than at this one.
>
> It is not fixed by re-pointing the tag. The commit would not move, but
> force-updating a pushed tag is the operation that produced panda-php's
> stray `v0.5.0`, and a rule that is suspended when the reason seems good
> enough is not a rule. The next spec tag is annotated, and the table above
> says which commit each one is.

## What is specified

| Document | Status |
|---|---|
| `envelope-format.md` | Normative. Envelope v1 wire format. |
| `blind-index-format.md` | Normative. Normalisation modes and encoding. |
| `token-format.md` | Normative. The access token format and the portal gate. |
| `cli-flags.md` | Normative. The long flag names of `init` and `generate`, and where a non-local provider's settings come from. |
| `vectors/vectors.json` | Envelope vectors (positive, negative), blind index vectors, and token format vectors. |

## The command line is now specified

`cli-flags.md` is the sixth instance of this project's recurring defect: **a
shared rule with more than one definition.** Here the rule is the command
line, and it had four.

The documentation prints one command and means it to be run whichever SDK the
reader picked. Five `init` flags were uniform — `--token`, `--kid`, `--quick`,
`--reinit`, `--skip-key-gen` — and each of them became uniform the same way:
added to all four in turn, each time after noticing that one SDK had it and
another did not. That is five separate discoveries of one defect, each
followed by a fix that addressed the instance rather than the cause.

`--provider` was the sixth, and it was in `panda-node` alone. The consequence
was not cosmetic: `init --quick` could not name a provider in the other three,
so it always chose `local`, and **Vault and Infisical were unreachable from a
CI pipeline in three of the four languages.** A team provisioning into Vault
from a build could do it in Node.js and not in the language they were actually
using.

Section 10 of `verify_interop.js` runs `init --help` and `generate --help` in
each SDK and asserts every pinned name appears in the output. It failed seven
times when it was first run — once for `panda-node`'s `generate`, twice each
for the other three — and passes now. The checks went from 164 to 200.

Two things are deliberately *not* pinned, and both are recorded in the
document rather than quietly omitted. **Short aliases** cannot be uniform:
Symfony Console reserves `-q` for its global `--quiet`, so `panda-php` cannot
offer `-q` for `--quick`, and it once tried — the collision threw from
`mergeApplicationDefinition()`, so `panda init` exited before running a line
of its own code while the command's own test file went on passing. A rule one
of the four cannot satisfy is not a rule. **`--keystore`**, which `panda-node`
had on both commands, is one concept under two names and is gone.

Nothing in the section asserts behaviour, only that the flag is offered. A
flag that is accepted and then discarded — which is what `panda-go`'s `--kid`
did before it was fixed — passes this check and is not caught by it. That is
stated in the document, because a check whose limits are not written down gets
trusted for more than it does.

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

## The whitespace divergence is closed

Every implementation now trims the Unicode `White_Space` set, so the three
characters that had to be left out of the vectors can be pinned.

All four diverged from the set, each in its own way — `strings.TrimSpace`
matched it only because it happens to include `U+0085`:

| | `U+0085` NEL | `U+001C` FS | `U+FEFF` BOM |
|---|---|---|---|
| the set | whitespace | not | not |
| Go `TrimSpace` | correct | correct | correct |
| PHP `trim()` | correct | correct | correct |
| Node `trim()` | **left it** | correct | **removed it** |
| Python `strip()` | correct | **removed it** | correct |

PHP was fixed first, then Node and Python. Node keeps `\p{White_Space}` in a
regex; Python passes the set to `strip()` explicitly, because `re` cannot help
— `\s` uses the same predicate as `str.isspace()` and carries the identical
bug.

Three vectors pin it, and each catches exactly the implementation it was
written for: restoring Node's `trim()` fails the first and third, restoring
Python's `strip()` fails the second. 164 interop checks, up from 152.

The note above stayed in the document through all of this saying the
divergence was "recorded rather than left to be rediscovered". It was accurate
when written and it is what kept the problem findable — but a document that
describes a defect for long enough starts to read like a specification of it,
so it now says Resolved, with the measured table kept.
