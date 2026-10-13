# PANDA Access Token Format (v1)

This document defines the one accepted spelling of a PANDA access token, and
what an implementation must do with it.

It exists because the format was pinned nowhere and written out four times.
Three of the four copies agreed by coincidence; the fourth accepted only
48 hex characters where the rest accepted 48 or 64, so a token the project
considers valid had exactly one implementation that refused it. A fifth copy
lived in the Go CLI, a sixth in `CLAUDE.md`, and a seventh in each of two
documentation pages. Nobody had written the rule down, so no copy could be
called the wrong one.

## Format

```
^panda_(demo|live)_([a-f0-9]{48}|[a-f0-9]{64})$
```

- The prefix is `panda_`, lowercase, anchored at the start.
- The type is `demo` or `live`, lowercase. No other value is accepted —
  `test`, `staging`, `prod`, `production`, `dev`, `sandbox` and the rest are
  not types.
- The payload is **48 or 64 lowercase hexadecimal characters** (`0`–`9`,
  `a`–`f`), and the whole string is anchored at the end.

### Two engines spell "end of string" differently

The pattern above is written with `$` because that is what most engines call
it. **An implementation must confirm that its `$` means end of string and not
"end of string, or just before a newline at the end."**

Two engines give it that second meaning:

| Engine | What `$` does | What to write instead |
|---|---|---|
| PCRE (PHP) | also matches before a final `\n` | the `D` modifier: `/(...)$/D` |
| Python `re` | also matches before a final `\n` | `\Z`: `r"(...)\Z"` |
| JavaScript | end of string only | `$` is correct |
| Go `regexp` | end of text only | `$` is correct |

This is not pedantry. A token read from a file, or pasted out of a heredoc,
carries a trailing newline routinely. With the quirk in place,
`panda_live_<48 hex>\n` was **a valid token in `panda-py` and `panda-php` and
invalid in `panda-node` and `panda-go`** — the same bytes, two answers. A user
would have had a token that worked in one SDK and was rejected by another, with
nothing in either message to say why.

The four vectors covering a trailing LF, CR and CRLF, and a leading newline,
exist for this. Reverting PHP's `D` or Python's `\Z` fails exactly two of the
152 checks — the two that name the engines with the quirk, and no others.

### Why lowercase

`[a-f0-9]`, not `[a-fA-F0-9]`.

A token is a credential, and it is compared byte-for-byte against what the
portal issued. Accepting both cases would mean two spellings of a token both
pass a local format check while only one of them is ever recognised — the
user's mistake surfaces later, at the portal, as "invalid token" rather than
at the prompt as "that is not the shape of a token". A format check exists to
catch exactly that, and a permissive one catches nothing.

### Why two lengths

48 hex characters encode 24 bytes; 64 encode 32. The portal issues both, so
both are accepted. Nothing between or beyond them is: 63 and 65 characters are
rejected, not rounded.

This is a widening of the earlier rule, which said 48 only. Widening is the
safe direction — every token that matched before still matches — which is why
it was chosen over narrowing to one length.

## Validation order

An implementation performs the checks in this order, and stops at the first
that fails:

1. **Presence.** An empty or missing token is an error, not a warning.
2. **Format.** The pattern above. A failure here is a warning that the caller
   may override — a user pasting a token from somewhere the project does not
   control should be told, not blocked. The exception is the CLI's `--token`
   flow, which is free to be strict.
3. **Portal validation.** See below.

## Portal validation

Everything except the demo token is validated against the portal before `init`
generates a key:

```
POST https://csirt.jatimprov.go.id/panda/api/v1/tokens/validate
Content-Type: application/json

{"token": "<the token>"}
```

The response carries `valid`, and on failure a `reason` of `invalid`,
`revoked`, or `already_activated`.

This step is **fail-closed**. A timeout, a connection error, a 5xx, or a
response that cannot be parsed all mean *no key is generated*. The one thing
it must never do is treat an unreachable portal as approval.

### `valid` must be the JSON boolean `true`

Not "truthy". **Only the literal boolean `true` is consent; every other value
is a refusal.**

The check was written as `if (!result.valid)` in JavaScript, `if
(!$result['valid'])` in PHP, and `if not result["valid"]` in Python. A
non-empty string is truthy in all three, so a body of

```json
{"valid": "false"}
```

— a response *explicitly saying the token is not valid* — was read as approval
and a key was generated. So was `{"valid": "no"}` and `{"valid": 1}`.

`panda-go` refused all of them, because decoding a JSON string into a Go `bool`
fails. That is what surfaced it: one implementation disagreed with the other
three, and it was the one that was right.

The failure is in the dangerous direction. An unreachable portal is at least
loud; a portal answering "no" in a form the client misreads is silent, and it
ends with a key being handed out on the strength of it. Implementations must
compare against the boolean — `!== true`, `!== true`, `is not True` — and treat
anything else, including the string `"true"` and the number `1`, as a refusal.

Two escape hatches exist, and both are deliberate:

| | Effect |
|---|---|
| The demo token | Skips the network call entirely. No HTTP request is made. |
| `PANDA_SKIP_ONLINE_VALIDATION=1` | Skips the network call. **For tests only.** |

The demo token is a fixed, published string that ships in `.env.example`. It
is not a secret and grants nothing; it exists so that a developer can run
`init` with no portal account.

> **Resolved.** `panda-py` performed no portal validation at all: it checked
> the format and proceeded, so any well-formed token — including one that had
> been revoked, or already used by another application — initialised
> successfully. It now calls the portal, and fails closed. This was recorded
> here as a known deviation and then fixed; the entry stays because the way it
> was found is the argument for the hand-written table below.
>
> **Also resolved, and worse.** Three of the four read `{"valid": "false"}` as
> approval — see the section above. That one was not visible in the table at
> all; it came out of writing the tests for it.

## What this gate is not

The SDK source is public, so this check is a soft gate for legitimate-usage
inventory. It is not an access-control boundary, and nothing may be protected
on the assumption that a key was only ever generated by an authorised caller.
Encryption keys are the thing that protects data; this token decides who gets
one, socially.

After `init` completes, every other operation — encrypt, decrypt, mask, blind
index — is offline and has no portal dependency.

## Status

| Implementation | Pattern | Portal validation |
|---|---|---|
| `panda-go` | `^panda_(demo\|live)_([a-f0-9]{48}\|[a-f0-9]{64})$` | yes |
| `panda-node` | `^panda_(demo\|live)_([a-f0-9]{48}\|[a-f0-9]{64})$` | yes |
| `panda-php` | `/(...)$/D` — PCRE's `$` needs the modifier | yes |
| `panda-py` | `r"(...)\Z"` — Python's `$` needs the anchor | yes |

The `tokenFormat` vectors in `vectors/vectors.json` are run against all four
implementations by `verify_interop.js`. They cover the pattern only — the
portal is a live service and is not something an offline test can assert
against. The portal column above is therefore recorded by hand and will go
stale silently; it is the reason it is written down here at all.

Two of the four entries in that column started out wrong, and neither was
found by reading this table. `panda-py`'s absence was found by writing it
down; the strict-`true` bug was found by writing tests for the portal call
that the table forced someone to make. A hand-written status table is worth
having for exactly that reason: not because it stays true, but because
filling it in is what makes you go and look.
