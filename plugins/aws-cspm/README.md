# aws-cspm

A [Claude Code](https://claude.com/claude-code) skill for **read-only AWS cloud security posture review**. It sweeps an account (or triages Prowler / Security Hub CSPM output) across IAM, S3 and data stores, network exposure, logging and detection, encryption and keys, serverless and container surfaces, and AI workloads (Bedrock, SageMaker, AgentCore), then rates every finding by its **actual exposure path and blast radius** instead of a scanner's default severity.

Scanners already list thousands of misconfigurations. This skill's job is the part they skip: *which five are real?*

> Install via the [nat20infosec marketplace](https://github.com/nat20infosec/skills): `/plugin marketplace add nat20infosec/skills` then `/plugin install aws-cspm@nat20infosec`.

## What it does

- **Triage, not enumeration.** Every candidate must pass four questions before it is rated above Low: is it reachable by the stated principal through the whole chain, what compensating controls exist, what is the blast radius, and is it intentional.
- **Attack paths.** 13 chains that are worse together than apart (internet-facing host + IMDSv1 + admin role, over-trusted OIDC roles, privilege-escalation primitives, a blind account), each mapped to MITRE ATT&CK for Cloud with the hops to confirm.
- **Honest coverage.** `AccessDenied` and throttling are reported as gaps in a coverage table, never as a clean result.
- **Verified control IDs.** An index of all 588 active Security Hub CSPM controls lets it cite control IDs and CIS AWS Foundations v5.0.0 mappings only when they are real.

## Safety

It never changes anything in the account. It runs an allowlist of `describe-*` / `list-*` / `get-*` calls from [`commands.md`](skills/aws-cspm/reference/commands.md), and explicitly refuses the `get-` calls that are not safe (`secretsmanager get-secret-value`, `ssm get-parameter --with-decryption`, `ec2 get-password-data`, `lambda get-function`, `logs get-log-events`, and others). It confirms the account ID with you before sweeping, treats everything AWS returns (tags, names, descriptions) as data and not instructions, keeps raw evidence local, and does not fetch objects or connect to endpoints to "confirm" a finding.

Run it with the AWS-managed **`SecurityAudit`** and **`ViewOnlyAccess`** policies on a dedicated, short-lived role. If the active principal is an admin, it says so.

## Modes

| Mode | When |
|---|---|
| Ingest | You have Security Hub CSPM / Prowler / ScoutSuite output. Preferred. |
| Targeted check | One question: "is anything public?", "is logging on in every region?" |
| Full sweep | All domains, all enabled regions. Confirms first; it is API-heavy and shows up in CloudTrail. |

## Use

```
/aws-cspm profile=audit-ro  is anything in this account publicly exposed?
```

or paste scanner output and ask what matters.

## Contents

| File | Purpose |
|---|---|
| [`SKILL.md`](skills/aws-cspm/SKILL.md) | Workflow, guardrails, triage rubric, severity table, report format |
| [`reference/commands.md`](skills/aws-cspm/reference/commands.md) | Read-only command catalog by domain, with what to read and what is not a finding |
| [`reference/attack-paths.md`](skills/aws-cspm/reference/attack-paths.md) | Chains mapped to ATT&CK for Cloud |
| [`reference/security-hub-controls.md`](skills/aws-cspm/reference/security-hub-controls.md) | Generated index of Security Hub CSPM controls |
| [`evals/`](evals) | Test cases for `claude plugin eval` |

## Status: v0.1.0

Verified so far:

- Every `aws` service, operation, and flag in `commands.md` exists in botocore's API models (`scripts/verify-aws-commands.py`, run in CI). This checks the commands are real, not that their output reads the way the skill assumes.
- The control index is regenerated from AWS's docs by `scripts/gen-securityhub-index.mjs`, which fails if any control in AWS's master table is missing.

Evals (Sonnet, 3 runs per case, with and without the skill, 2026-11-17): all 5 cases passed in both arms, so **the suite does not yet show the skill adding anything**. The score delta is 0 on every case, because the model already handles these scenarios unaided. The skill also loaded in only 1 of the 4 relevant cases (it fired on the security-group case, not on the S3, access-denied, or tag-injection ones), so its description needs work on triggering for pasted scanner output. Next steps: cases hard enough that the no-skill arm fails, and a trigger fix.

**Not yet verified:** it has not been run against a live account. Treat the first few reviews as a shakedown, and read the coverage table before trusting a "no findings" result.

```bash
claude plugin eval plugins/aws-cspm            # real model calls, billed to your account
node scripts/gen-securityhub-index.mjs         # refresh the control index from AWS's docs
```

## Sources and attribution

- Security Hub CSPM control IDs, titles, severities, and Config rule names in the index are AWS's, extracted from the [Security Hub CSPM user guide](https://docs.aws.amazon.com/securityhub/latest/userguide/standards-reference.html). Descriptions and remediation text are not copied; each service heading links to AWS's page.
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services), [MITRE ATT&CK for Cloud](https://attack.mitre.org/matrices/enterprise/cloud/), [OWASP Top 10 for LLM Applications](https://genai.owasp.org/) and the OWASP Agentic Top 10 are referenced by ID only.
- The "pattern match is not a vulnerability" triage framing is shared with, and was influenced by, [agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp) (MIT).

## License

[MIT](../../LICENSE)
