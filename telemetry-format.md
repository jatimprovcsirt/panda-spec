# The telemetry format

Normative. This document pins what the SDKs report to the portal, how the
counters are accumulated, and — the part an organization will actually ask about —
what is never sent.

## Why this is specified at all

The SDK and the portal are separate repositories, written by different hands,
and the contract between them was written down in neither. Four senders and one
receiver agreed by coincidence, and did not agree:

- The SDKs sent `{token, keyFingerprint, sdkVersion, language}`.
- The portal read `{token, eventType, metadata}`.

So `eventType` was empty on every event, and `sdkVersion` — the one field the
vulnerability warning (FR-15) depends on — was discarded by the receiver.
Nothing failed, because the endpoint was never reached: the SDKs posted to
`portal.panda.gov.id`, a hostname that does not exist, which `panda-php`'s own
source labelled `// Placeholder URL`.

That is the sixth instance of this project's recurring defect: **a shared rule
with more than one definition.** It is pinned here so the seventh is a failing
check rather than a discovery.

## What is never sent

This is the guarantee the format exists to make checkable. The payload carries
**no** plaintext, no ciphertext, no key material, no field name, no field value,
no record identifier, and no personal data.

An organization's question is "where does our data go", not "is there a socket". The
answer this format supports: **encryption, decryption and masking happen inside
the application process, and what leaves is a count.**

The one value derived from a key is `keyFingerprint`, and it is sent once per
key, at the moment the key is created — never alongside an operation. It is
`base64(SHA-256(key))` over the 32 random key bytes. It is not invertible and
does not correlate with a person. Its only purpose is to let the portal notice
the same key appearing at two different applications, which is what a copied
`.env` looks like from the outside.

## The endpoint

```
POST https://csirt.jatimprov.go.id/panda/api/v1/telemetry
```

The receiver answers `202 Accepted` to every request, including malformed ones,
so that a sender never retries. This is the fail-silent contract: a network
failure, a timeout, a DNS failure, or any non-2xx response is swallowed by the
SDK and never raised to the caller or allowed to delay a crypto operation.

**Every SDK derives this from the same base URL as the token gate**
(`.../panda/api/v1/tokens/validate`). Two constants for one host is how
telemetry came to point somewhere else entirely.

## Event: `usage`

Sent when the flush trigger fires (see below).

```json
{
  "eventType": "usage",
  "token": "panda_live_…",
  "sdkVersion": "0.5.6",
  "language": "node",
  "windowSeconds": 300,
  "counters": {
    "encrypts": 4200,
    "decrypts": 3100,
    "decryptsRaw": 12
  }
}
```

| Field | Meaning |
|---|---|
| `token` | The application's access token, identifying the installation. |
| `sdkVersion` | The SDK's real version. Not a literal. |
| `language` | `node`, `php`, `go` or `python`. |
| `windowSeconds` | How long the counters have been accumulating. Lets the receiver sanity-check a report. |
| `counters` | Counts **since the last successful report**, per the delta rule below. |

### Which operations are counted

Exactly three, each incremented at the **public cipher method** — which is the
point, because the previous set was defined by where someone remembered to add
a call, and so `decrypt()` — the masked read, the most common path of all —
was not counted at all.

| Counter | Incremented by |
|---|---|
| `encrypts` | `encrypt()` |
| `decrypts` | `decrypt()` — the masked read |
| `decryptsRaw` | `decryptRaw()` — the audited full-plaintext read |

`decryptRaw` is deliberately **not** merged into `decrypts`. It is the
sensitive operation, audited separately precisely because it returns full
plaintext, and its shape per organization is a governance signal: an installation
whose raw-decrypt count is high is doing something different from its peers.
Merging the two destroys that signal for no gain.

`mask()` and the blind index are **not** counted. Masking is a display
transform, and the blind index is a hash for lookup; neither is an operation on
protected data, and including them would inflate "operations" with things that
are not encryption.

Key generation is **not** a counter here. It is the `key` event, so that the
number of keys has exactly one definition rather than two.

## Event: `key`

Sent once, when a key is generated.

```json
{
  "eventType": "key",
  "token": "panda_live_…",
  "sdkVersion": "0.5.6",
  "language": "node",
  "keyFingerprint": "9f2c…"
}
```

The receiver increments the installation's key count. It is a separate event
rather than a counter because it carries a value the `usage` event must not:
the fingerprint.

## The delta rule

> A report carries the count of operations **since that installation's last
> successful report** — not a lifetime total.

An application runs as more than one process. A Laravel application is several
PHP-FPM workers; a Python application behind gunicorn is several worker
processes; a Node application in cluster mode is several processes. Each has
its own memory and knows nothing of the others.

If each reported a *lifetime total*, the receiver would have to identify which
process each number came from, replace the previous number from that same
process, and detect a restart (a process that has restarted counts from zero
again, and that is not a decrease). If each reports a *delta*, the receiver
does none of that: **it adds every report it receives.**

### The counter resets only after the receiver answers 2xx

This is not a detail. Without it, "delta" would mean "whatever happened in the
last window that also happened to get through", and a portal outage would
silently discard those counts.

With it, a failed flush leaves the counter untouched, the next window
accumulates on top, and the numbers arrive late rather than not at all.

### A failed report is never retried

Retrying would risk counting the same window twice. The counts stay in the
counter and are carried by the next report. This costs nothing under the rule
above.

### Nothing is sent when the counters are zero

An idle installation makes no request. Silence is the correct report for
"nothing happened".

## The flush trigger

Whichever of these is reached first:

| Trigger | Default |
|---|---|
| Time since the last successful report | 300 seconds |
| Operations since the last successful report | 1000 |

Both are defaults a deployment may override; the *shape* — time or volume,
whichever comes first — is what is pinned, because a trigger that is only
time-based reports too rarely on a busy installation and one that is only
volume-based reports too rarely on a quiet one.

## Where the counter lives, per runtime

The delta rule says a counter accumulates between reports. In a single-process
runtime it lives in the process. In a **multi-worker** runtime that is not
enough, and the reason is worth stating because it is not obvious:

A PHP-FPM worker handles requests and is then recycled. Its in-memory counter
sees one slice of the traffic and **dies with the worker** if it has not
flushed. Busy installations flush before that happens; quiet installations —
which is the government deployment profile — lose the counts. The bias falls on
exactly the installations most worth counting.

So in a multi-worker runtime the counter is kept in a store shared by the
workers of one installation:

1. The **hot path** increments an in-process counter. One addition, no I/O.
2. At **request shutdown** that value is merged into the shared store and the
   in-process one is reset. This is what survives worker recycling.
3. The flush trigger is read from the shared store, so all workers of an
   installation share one interval and send one report between them instead of
   one per worker.

**Store selection, in order:** APCu when the extension is available; otherwise
a lock-protected file; otherwise process memory alone, **and that degradation is
logged**. A silent fall back to the lossiest option is how a statistics figure
becomes quietly wrong.

## What the receiver must do

- **Sum deltas.** Never treat a report as an absolute value, and never store
  the SDK's number as a running total it then reads back.
- **Store per installation; display aggregates.** Counting in aggregate alone
  would make the vulnerability warning impossible — it cannot tell an organization
  its SDK is out of date without knowing which installation runs which version.
  Sharing that is a separate question from storing it: **no per-organization figure
  is displayed anywhere.**
- **Accept a `key` event as the only source of the key count.**

## What this document does not pin

Help text, SDK-internal storage, the retry policy of the *receiver*, and the
figures the portal chooses to display. The last is a product decision; this
document only fixes what may be sent and how it adds up.

## How this is checked

`verify_interop.js` section 11 gives every implementation the same counters and
asserts they produce the same JSON. The payload is serialisable offline, so it
is testable offline — no portal required, and no test that would pass only
against a live service.

Nothing in that section asserts that an SDK *sends* anything. Whether the flush
trigger fires, whether the shared store degrades correctly, and whether the
cipher calls the counter at all are each covered by that SDK's own test suite,
because they are behaviour rather than format.
