# The CLI flag set

Normative. This document pins the long flag names of `panda init` and
`panda generate` across all four SDKs, and `verify_interop.js` section 10 is
what keeps them true.

## Why this is specified at all

The documentation prints one command, and it is meant to be run whichever SDK
the reader picked. That is the whole point of a cross-language SDK: the guide
says

```
panda init --quick --token panda_live_<your-token> --kid my-app-key-1
```

and it is supposed to be true in PHP, Node.js, Go and Python alike. When it is
not, the guide is not "approximately right for one language" — it is wrong, and
it is wrong for whoever chose the SDK that lacks the flag. The four SDKs are
for four different teams, and no team can see the third column of a table the
documentation does not have.

This is the same defect as the envelope encoding, the blind index
normalisation, the token pattern and the credential file layout: **a shared
rule with more than one definition.** Here the rule is the command line, and it
had four definitions.

## Pinned: `panda init`

| Flag | Meaning |
|---|---|
| `--token <token>` | Per-application access token, validated against the portal. |
| `--kid <kid>` | Key identifier for the first key. Defaults to `default-key`. |
| `--quick` | Non-interactive setup. No prompt is issued on this path. |
| `--reinit` | Proceed even if the project is already initialised. |
| `--skip-key-gen` | Configure the provider without generating the first key. |
| `--provider <type>` | Key provider: `local`, `vault` or `infisical`. Defaults to `local`. |

## Pinned: `panda generate`

| Flag | Meaning |
|---|---|
| `<kid>` | Key identifier, as a positional argument. |
| `--description <text>` | Free-text description stored alongside the key. |
| `--provider <type>` | Provider to store the key in. Defaults to the one `init` recorded. |

## Where a non-local provider's settings come from

`--provider` names the provider. It does not carry its settings, and on the
non-interactive path there is nobody to ask for them, so all four SDKs read
the same environment variables — the ones already listed in `CLAUDE.md` and
already read by `VaultKeyProvider` and `InfisicalKeyProvider`:

| | Required | Defaulted |
|---|---|---|
| `vault` | `PANDA_VAULT_URL`, and either `PANDA_VAULT_ROLE_ID` + `PANDA_VAULT_SECRET_ID` or `PANDA_VAULT_TOKEN` | `PANDA_VAULT_MOUNT_PATH`, `PANDA_VAULT_TOKEN_TTL` |
| `infisical` | `PANDA_INFISICAL_CLIENT_ID`, `PANDA_INFISICAL_CLIENT_SECRET`, `PANDA_INFISICAL_PROJECT_ID` | `PANDA_INFISICAL_SITE_URL`, `PANDA_INFISICAL_ENVIRONMENT`, `PANDA_INFISICAL_CACHE_TTL` |

`PANDA_VAULT_AUTH_METHOD` is honoured when set. When it is not, it is
**inferred**: role and secret present means `approle`, a token present means
`token`, neither means an error naming the variable. Demanding it when the
caller has already answered the question by setting the others is the
difference between a quick init that works and one that argues.

**A missing required variable stops `init` and writes nothing** — no `.panda`
directory, no `.env`, no keys. The wizard may offer `http://127.0.0.1:8200` as
a default because a person is there to see it and disagree; `--quick` cannot
ask, and a credentials file naming a Vault that nothing said to use behaves
like a working configuration until the first decrypt. This is the same
fail-closed shape the token gate already has on this path.

The refusal names **every** variable that is missing, not the first. A message
saying "Vault is not configured" sends the reader to the documentation; one
that lists the variables sends them to their shell.

## No local key is written for a non-local provider

`init --quick --provider vault` records a configuration and generates nothing.
A key generated "for" a secret manager is a second key that nothing reads, and
it would be the one in `.env` that a later `panda generate` does not know
about. `--skip-key-gen` therefore has nothing to suppress on this path, and
key creation stays where it belongs: `panda generate <kid>`.

## What is deliberately not pinned

**Short aliases.** `panda-node` and `panda-php` both accept `-k` for `--kid`,
but the set cannot be made to match, and the reason is not cosmetic. Symfony
Console reserves `-q` for its global `--quiet`, so `panda-php` cannot offer
`-q` for `--quick` at all. It once did, and the collision was thrown from
`mergeApplicationDefinition()` — from the *application's* definition, not the
command's — which is why the command's own test file went on passing while
`panda init` could not start. A short-alias rule that one of the four cannot
satisfy is not a rule, so the pinned set is long flags only, and the two SDKs
that offer `-k` are free to keep it.

**`--yes`.** Only `panda-node` has it, on `generate`. Nothing else in the flag
set needs it: given `<kid>`, no SDK prompts, so there is no confirmation for
`--yes` to skip. It changes behaviour only in the case where `<kid>` is
*absent*, where it turns a prompt into an error — and all four prompt when
`<kid>` is absent, so the flag describes a preference rather than a capability.
Its help text ("Skip confirmation prompts") does not match what it does.

**`--keystore`.** Only `panda-node` has it, and it is one concept under two
names: an alias for `--provider` on `init`, and on `generate` a provider
override that *also* happens to force the non-interactive path, because that
path is chosen with `options.yes || options.keystore`. Two names for one thing
is two definitions of it, so this document pins `--provider` and nothing else.

**Help text, ordering, and the wizard's questions.** A vector asserting a
description string would fail on a typo fix and pass on a behaviour change.

## How this is checked

`verify_interop.js` section 10 runs `init --help` and `generate --help` in each
of the four SDKs and asserts that every flag named above appears in the output.
The pinned names live in `vectors/vectors.json` under `cli`, so the document
and the check read the same list rather than two copies of it.

Nothing here asserts *behaviour*, only that the flag is offered. A flag that is
accepted and then discarded — which is what `panda-go`'s `--kid` did before it
was fixed — passes this check and is not caught by it. The CLI's own test suite
is where that belongs, and `panda-py`'s `ci.yml` runs the binary and asserts
its flags exist for the same reason: every unit test passed there while the
command could not start.

## What this pin was written against

Measured by running `--help` in all four SDKs, not read from the source:

| Flag | panda-node | panda-php | panda-go | panda-py |
|---|---|---|---|---|
| `init --token` | yes | yes | yes | yes |
| `init --kid` | yes | yes | yes | yes |
| `init --quick` | yes | yes | yes | yes |
| `init --reinit` | yes | yes | yes | yes |
| `init --skip-key-gen` | yes | yes | yes | yes |
| `init --provider` | yes | **no** | **no** | **no** |
| `generate <kid>` | yes | yes | yes | yes |
| `generate --description` | yes | yes | yes | yes |
| `generate --provider` | `--keystore` | **no** | **no** | **no** |

The five flags in the upper block were already uniform before this document
existed, and they are uniform because each was added to all four in turn —
`--skip-key-gen` last, `--quick` and `--kid` before it, each time in response
to noticing that one SDK had it and another did not. That is five separate
discoveries of the same defect. `--provider` is the sixth, and it is pinned
here so that the seventh is a failing check rather than a bug report.

`--provider` is not decoration. Without it, `panda init --quick` cannot
configure Vault or Infisical at all in three of the four SDKs — the
non-interactive path had no way to name a provider, so it always chose `local`.
A team provisioning into Vault from a pipeline could do it in Node.js and not
in the language they were actually using.
