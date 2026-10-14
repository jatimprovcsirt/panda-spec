# PANDA Blind Index Format (v1)

This document describes how a blind index is computed, so that a value indexed
by one implementation is found by another.

The rules below are checked by the `blindIndex` vectors in
`vectors/vectors.json`, run against all four implementations by
`verify_interop.js`. A change to this document that no implementation follows
fails that run — which is how it should be, and was not always the case.

It exists because the encoding and the normalisation rules were, until now,
pinned nowhere. Four implementations agreed by coincidence rather than by
agreement, and the only document that mentioned the encoding at all said
something untrue about it.

## Computation

```
index = base64( HMAC-SHA256( indexKey, normalize(value, mode) ) )
```

The `indexKey` is deployment configuration, not derived from the value. It
must be the same across every system that has to match on the same column.

## Normalisation modes

The value is normalised before it is hashed. Two systems that normalise
differently produce different indexes for the same value and then never
match — silently, because an index that matches nothing looks exactly like a
record that is not there.

| Mode | Aliases | Operation |
|---|---|---|
| `lowercase` | `email` | Remove leading and trailing whitespace, then lowercase. |
| `nik` | `digits`, `phone` | Remove every character that is not an ASCII digit (`0`–`9`). |
| `trim` | — | Remove leading and trailing whitespace. |
| `none` | `raw` | Use the value unchanged. |

Whitespace means the characters carrying the Unicode `White_Space` property,
not only the ASCII space. The one that matters in practice is the
non-breaking space, `U+00A0`: it arrives whenever a value is pasted out of a
word processor or a spreadsheet, and a NIK carrying one is a different value
to the same NIK without it.

Lowercasing follows the host language's standard string lowercasing.

> **Known deviations.** Delegating to the host language's `trim()` produces
> four different sets, because each language means something slightly different
> by it. Measured, not inferred — every row below was run:
>
> | | `U+0085` NEL | `U+001C` FS | `U+FEFF` BOM |
> |---|---|---|---|
> | Go `strings.TrimSpace` | removes | — | — |
> | Node.js `trim()` | — | — | **removes** |
> | Python `strip()` | removes | **removes** | — |
> | PHP `trim()` | — | — | — |
>
> All four implementations now trim this set exactly. The table above is kept
> as the record of what each language's built-in does, because reaching for
> `trim()` is still the obvious thing to do and the difference is invisible
> until a value carries one of these characters.
>
> **Resolved.** Every row was measured, and all four diverged from the set in
> the third column — `Go TrimSpace` matched it only by accident of including
> `U+0085`, and the other three each got a different pair wrong. PHP was fixed
> first, then Node and Python:
>
> - PHP replaced `trim()` with an explicit PCRE class.
> - Node keeps `\p{White_Space}` in a regular expression. JavaScript's `trim()`
>   strips `U+FEFF`, which is not whitespace, and leaves `U+0085`, which is.
> - Python passes the set explicitly to `strip()`. `str.strip()` uses
>   `str.isspace()`, which also removes `U+001C`–`U+001F`; those are control
>   characters, not whitespace. `re` is no help — `\s` uses the same predicate,
>   so `re.sub(r"^\s+", ...)` carries the identical bug.
>
> Three vectors pin them: a trailing `U+0085`, `U+001C` and `U+FEFF`. Each one
> catches exactly the implementation it was written for — restoring Node's
> `trim()` fails the first and third, restoring Python's `strip()` fails the
> second.
>
> The characters are obscure and the practical risk is low, which is why they
> survived so long. But the failure mode is not a lookup that misses — it is a
> value that indexes differently in one SDK than the others, so a row written
> by one is not found by another, and nothing reports it.

`lowercase` is the default when a caller does not choose. It is the default
because it cannot empty a value — see the hazard below.

## Encoding

The result is **RFC 4648 §4 standard base64** of the 32-byte HMAC, which is
44 characters ending in `=`. The characters `+` and `/` appear; the
URL-safe alphabet is not used.

Store it in a `VARCHAR(64)`. The column must not be sized to the plaintext:
it must be wide enough for the encoding regardless of how short the value is.

It is not hex. Hex would be 64 characters over the same 32 bytes.

## The empty-string hazard

`nik` removes everything that is not a digit. Applied to a value that contains
no digits — a name, an email address, a place of birth — it produces the empty
string, and **every such value then shares one index**.

This is not a lookup that fails. It is a lookup that returns whatever else
shares that index, which for those values is every row in the column. Nothing
about the answer looks wrong.

`nik` is therefore appropriate only for values that are meant to be digits, and
implementations must not apply it by default. It has to be asked for.

## Unknown modes

An implementation must not treat an unrecognised mode as `none`. Doing so
turns a caller's typo into an index computed over input that was never
normalised, which matches nothing and reports no error.

> **Known deviation.** As of this writing the four SDKs fall back to the
> unmodified value for a mode they do not recognise. `panda-docker` refuses
> instead. A caller passing a mistyped mode to an SDK currently gets a valid
> looking index over the wrong input.

## Immutability

An index is derived from the value, the index key, and the mode. Changing any
of the three means re-indexing every row; rows indexed under different inputs
will never match those indexed under others.

All three must be decided before the first row is written.
