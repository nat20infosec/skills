# aws-cspm

A Claude Code skill for read-only AWS cloud security posture review. It sweeps an account (or triages Prowler / Security Hub CSPM output) across IAM, S3 and data stores, network exposure, edge and APIs, logging and detection, encryption and keys, serverless and container surfaces, and AI workloads (Bedrock, SageMaker, AgentCore), then rates every finding by its actual exposure path and blast radius instead of a scanner's default severity.

Scanners already list thousands of misconfigurations. This skill's job is the part they skip: which five are real?

Install via the nat20infosec marketplace: `/plugin marketplace add nat20infosec/skills` then `/plugin install aws-cspm@nat20infosec`.

## What it does

- **Triage, not enumeration.** Every candidate must pass four questions before it is rated above Low: is it reachable by the stated principal through the whole chain, what compensating controls exist, what is the blast radius, and is it intentional.
- **Attack paths.** 17 chains that are worse together than apart (internet-facing host + IMDSv1 + admin role, over-trusted OIDC roles, privilege-escalation primitives, public data stores, dangling DNS, anonymous Cognito credentials, a blind account), each mapped to MITRE ATT&CK for Cloud with the hops to confirm.
- **Honest coverage.** Every call lands in one of five states: Checked, Not configured, AccessDenied, Throttled, Not applicable. AccessDenied and throttling are reported as gaps in a coverage table, never as a clean result; documented "absent" errors (`NoSuchBucketPolicy` and friends) are completed checks, not gaps.
- **Verified control IDs.** An index of all active Security Hub CSPM controls lets it cite control IDs and CIS AWS Foundations v5.0.0 mappings only when they are real, and tells it which controls AWS has retired.

## Safety

It never changes anything in the account. Read-only is enforced in three layers:

1. **The IAM role.** Run it with the AWS-managed `SecurityAudit` and `ViewOnlyAccess` policies on a dedicated, short-lived role. This is the real boundary. If the active principal is an admin, the skill says so.
2. **The catalog.** `reference/commands.md` is an allowlist of `describe-*` / `list-*` / `get-*` calls (plus `iam generate-credential-report`). Anything not in a code block there is off limits, and `SKILL.md` names the `get-` calls that look safe and are not (`secretsmanager get-secret-value`, `ssm get-parameter(s)`, `lambda get-function`, `lambda get-function-configuration`, `logs get-log-events`, and others).
3. **A PreToolUse hook.** While the skill is active, `scripts/guard-aws.mjs` blocks any `aws` Bash call outside the catalog, reads of `~/.aws` credential and cache files, and `prowler` runs that do not exclude their secret-scanning checks. The policy is unit-tested offline (`scripts/guard-aws.test.mjs`).

It also confirms the account ID, principal and production status with you before sweeping, treats everything it reads (AWS responses, tags, scanner output) as data and not instructions, writes raw evidence only to a private temp directory outside any git working tree, and does not fetch objects, resolve hostnames, or connect to endpoints to "confirm" a finding.

Hook behavior to know about: skill hooks stay registered for the rest of the session once the skill has been invoked, so in that session non-catalog `aws` calls stay blocked after the review ends. Start a new session for ordinary AWS work. If the hook script itself fails to run (for example, Node is missing), Claude Code treats that as a non-blocking error and the IAM role is the only remaining control.

## Modes

| Mode | When |
|---|---|
| Ingest | You have Security Hub CSPM / Prowler / ScoutSuite / Steampipe output. Preferred. |
| Targeted check | One question: "is anything public?", "is logging on in every region?" |
| Full sweep | All domains, all enabled regions. Confirms first; it is API-heavy and shows up in CloudTrail. |

## Use

```
/aws-cspm profile=audit-ro  is anything in this account publicly exposed?
```

or paste scanner output and ask what matters. Calls run under the confirmed profile on every invocation.

## Contents

| File | Purpose |
|---|---|
| `skills/aws-cspm/SKILL.md` | Workflow, guardrails, triage rubric, severity table, report format |
| `skills/aws-cspm/reference/commands.md` | Read-only command catalog by domain, call-result classification, what to read and what is not a finding |
| `skills/aws-cspm/reference/attack-paths.md` | Chains mapped to ATT&CK for Cloud |
| `skills/aws-cspm/reference/security-hub-controls.md` | Generated index of Security Hub CSPM controls |
| `scripts/guard-aws.mjs`, `guard-lib.mjs` | The PreToolUse hook and its policy |
| `scripts/guard-aws.test.mjs` | Offline tests for the hook |
| `evals/` | 17 test cases for `claude plugin eval` |

## Status: v0.2.0

What changed from v0.1.0, from a line-by-line review of the whole plugin:

- **Read-only enforcement.** Added the hook. Removed the contradictions between "allowlist, not verb" and the verb-based rule, between the Prowler offer and the never-run list, and between `ssm get-parameter --with-decryption` being banned while plain `get-parameter` was implied safe.
- **Bugs fixed in the catalog.** Shell variables and `export`s do not survive between Bash calls, so the setup block never worked as written; calls now carry the profile and pager setting explicitly. Evidence files no longer go to the working directory (they could land in a git repo). Credential report generation is polled instead of raced. Access Analyzer is per-region. Expected "not configured" errors are no longer counted as gaps. `eks list-clusters`, Aurora cluster snapshots, S3 bucket ACLs (which `get-bucket-policy-status` ignores), and metric filters and event patterns (names alone cannot show what is alarmed) were missing and are added.
- **Coverage added.** OpenSearch, Redshift, EFS, CloudFront, Route 53 (dangling DNS), API Gateway, Cognito. The catalog now ends with an explicit "not covered" list so the brief can say what it did not look at.
- **Rubric fixes.** Critical now means no precondition or a standing credential whose theft alone is total takeover, so an active root key is Critical and root-without-MFA is High. Attack-path chain 6 no longer treats user MFA as protecting access keys or claims the credential report shows source IPs. Chain 5 now lists the privilege-escalation primitives that were missing (`PutRolePolicy`, `AddUserToGroup`, `CreateLoginProfile`, and the specific PassRole-plus-compute pairs).
- **Triggering.** The description now leads with the use cases and the phrases people actually use.
- **Evals.** Added cases the model should not pass without the skill: CIS numbering from the verified index, a retired control, severity calibration, not-configured vs denied, ACL-only public buckets, injection planted in scanner output, brief shape, plus trigger and negative cases.
- **CI.** The command verifier now also fails if the catalog contains a non-read-only verb or a never-run call, and the hook tests run on every push.

Verified so far, offline:

- Every `aws` service, operation, and flag in `commands.md` exists in botocore's API models, and the catalog contains only `describe-` / `list-` / `get-` operations plus two named exceptions, none of them on the never-run list (`scripts/verify-aws-commands.py`, run in CI). This checks the commands are real, not that their output reads the way the skill assumes.
- The hook policy passes its unit tests, including smuggling attempts through `bash -c`, command chaining, `$(...)`, and a catalog checked out with Windows (CRLF) line endings, which would otherwise make it block every call.
- The control index is regenerated from AWS's docs by `scripts/gen-securityhub-index.mjs`, which fails if any control in AWS's master table is missing. It was not regenerated for this release.
- `claude plugin validate --strict` passes on the plugin, the marketplace, and the skills directory.

**Not yet verified:**

- It has **not been run against a live account.** Treat the first few reviews as a shakedown, and read the coverage table before trusting a "no findings" result.
- The **hook has not been exercised inside a real Claude Code session.** The unit tests cover its decisions, not the wiring (that `${CLAUDE_PLUGIN_ROOT}` resolves in a skill hook). After installing, run the smoke test below.
- **The evals show the skill adds less than the headline suggests.** See "Eval results" below.

### Eval results (v0.2.0, Sonnet, 3 runs per case, each with and without the skill)

All 15 cases pass with the skill. Without it, 11 of 15 pass. Cost about $4.30, 5.5 minutes.

What that does and does not show:

- **Real wins (2).** `control-id-lookup` (the model cannot reliably give Security Hub severities and CIS v5.0.0 numbers from memory; with the index it can) and `posture-brief-shape` (follows the Posture Brief format; this measures format adherence, not better security judgment).
- **Built-in wins (2).** `trigger-inherited-account` and `trigger-pasted-scanner-summary` are scored on whether the skill loads, which the no-skill arm can never do, so their delta says nothing about quality.
- **No measurable difference (11).** On the triage and honesty cases (reachability, blocked-vs-public buckets, access-denied as a gap, injection in tags or scanner output, root MFA severity, retired control, and others) the model already gets them right without the skill. These work as regression guards, not evidence the skill helps.
- **Triggering is better but not fixed.** The skill loaded in 31 of 39 runs across the cases that expect it. It still did not load on `access-denied-is-a-gap` (0/3) and `tag-prompt-injection` (0/3), and loaded in only 1 of 3 runs on `absent-vs-denied`. Those are pasted-output prompts where the user says not to run anything.
- **Added after that run (2).** `oidc-trust-chain` (GitHub OIDC admin role with no `sub` condition vs a correctly scoped one) and `scp-not-assessed` (a yes/no SCP question when the Organizations calls were denied). Run separately, 3 runs each: both pass 3/3 with and without the skill, and the skill did not load in any run, so they are regression guards too (about $0.60 for both arms).
- **Next:** triage cases hard enough that the no-skill arm fails, and a description fix for the pasted-output cases.

### Hook smoke test

After `/plugin install aws-cspm@nat20infosec`, in a throwaway session with credentials for a read-only role, invoke the skill and ask it to run `aws s3 ls`. It should be blocked with "not in reference/commands.md". Then ask for `aws sts get-caller-identity`; that should run. If the first one runs, the hook is not wired and only the IAM role is protecting the account.

```bash
claude plugin eval plugins/aws-cspm            # real model calls, billed to your account
node --test plugins/aws-cspm/scripts/guard-aws.test.mjs   # offline hook tests
python scripts/verify-aws-commands.py          # offline command checks (pip install botocore)
node scripts/gen-securityhub-index.mjs         # refresh the control index from AWS's docs
```

## Sources and attribution

- Security Hub CSPM control IDs, titles, severities, and Config rule names in the index are AWS's, extracted from the Security Hub CSPM user guide. Descriptions and remediation text are not copied; each service heading links to AWS's page.
- CIS AWS Foundations Benchmark, MITRE ATT&CK for Cloud, OWASP Top 10 for LLM Applications and the OWASP Agentic Top 10 are referenced by ID only.
- The "pattern match is not a vulnerability" triage framing is shared with, and was influenced by, [agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp) (MIT).

## License

MIT
