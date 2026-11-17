# Attack paths: findings that are worse together

Individual misconfigurations are usually Low to Medium. The findings that matter are chains where each hop is satisfied by something in the account. Use this list during step 4 of the workflow: for each chain, confirm every hop with evidence from the sweep, then rate by the **precondition at the first hop** (what the attacker needs to start) and the **blast radius at the last hop** (what they get).

A chain you cannot fully confirm is "Likely" or "Needs verification", with the unconfirmed hop named. Do not assert a hop you did not see.

| # | Chain | Hops to confirm | Typical rating | ATT&CK for Cloud |
|---|---|---|---|---|
| 1 | Internet-facing host, IMDSv1, powerful instance role | Public IP or internet-facing LB, reachable port, `IMDS: optional`, instance profile whose role is broad. The first hop also needs a way to make the host issue a request (an app flaw such as SSRF), which you usually cannot see: say so. | High (Critical if the role is admin and the app flaw is known) | T1190, T1552.005, T1078.004 |
| 2 | Public bucket holding sensitive data | `IsPublic: true`, Block Public Access off at bucket **and** account level, name/tags suggesting sensitive contents. | Critical | T1530 |
| 3 | Publicly shared snapshot or AMI | `--restorable-by-user-ids all` returns it, or `describe-images --filters is-public` does. An RDS manual snapshot with `restore` containing `all`. | Critical if the source held sensitive data; otherwise High | T1530, T1537 |
| 4 | Over-trusted role | Trust policy principal is `*`, or another account's root without `sts:ExternalId`, or a GitHub OIDC provider with no `sub` (and `aud`) condition; role grants broad permissions. | High to Critical by the role's permissions | T1199, T1078.004 |
| 5 | IAM privilege-escalation primitive | A principal with `iam:PassRole` plus a compute-create action, or `iam:CreatePolicyVersion`, `iam:SetDefaultPolicyVersion`, `iam:AttachUserPolicy`, `iam:AttachRolePolicy`, `iam:PutUserPolicy`, `iam:UpdateAssumeRolePolicy`, or `iam:CreateAccessKey` on others. The principal must be one an attacker could plausibly hold (a developer role, a CI role). | High | T1098.003, T1098.001 |
| 6 | Long-lived keys on a privileged user | Access key older than 90 days or never rotated, user has admin or broad permissions, no MFA enforced on the user, keys appear in the credential report as used from outside expected places. | High | T1078.004, T1098.001 |
| 7 | Active root access key, or root without MFA | `AccountAccessKeysPresent: 1`, or `AccountMFAEnabled: 0`. | Critical | T1078.004 |
| 8 | Blind account | No multi-region CloudTrail (or `IsLogging: false`), GuardDuty off in a region that runs workloads, Config not recording. Not an exposure by itself, but it removes the ability to see chains 1 to 7. | Medium to High as an amplifier; say so | T1562.008 |
| 9 | Guardrail-free organization | In the management account: no SCP denying `cloudtrail:StopLogging`, `guardduty:DeleteDetector`, `organizations:LeaveOrganization`, or use of unused regions. | Medium; High when combined with 5 or 6 | T1562.008, T1578 |
| 10 | Unauthenticated function or queue | Lambda function URL `AuthType: NONE`, or an SNS/SQS policy with `Principal: "*"` and no source condition, attached to a function or consumer with a broad role. | High | T1190 |
| 11 | Destructible data | Bucket with broad write/delete permissions for non-admin principals, versioning off, no Object Lock; RDS with backups disabled and no deletion protection. | Medium to High | T1485, T1486, T1490 |
| 12 | Mutable supply chain | ECR tags are mutable and deployments pull by tag; CI role (OIDC) can push to the registry; no signing. | Medium to High | T1195.002, T1525 |
| 13 | Exposed AI workload | A SageMaker notebook with direct internet access, root access, and a broad execution role; a Bedrock agent or AgentCore gateway with no inbound authorizer and a broad role; invocation logging off. | High | T1190, T1078.004; OWASP LLM06 Excessive Agency, ASI02 Tool Misuse and ASI03 Identity and Privilege Abuse |

## Checking a chain

1. Write the chain as a one-line path: *who or what, through which hops, reaches what*.
2. For each hop, cite the command and field that confirms it. Mark any hop you could not see.
3. Check compensating controls at every hop: an SCP or permission boundary on the role, a `Condition` on the trust policy, a VPC endpoint policy, a WAF, private subnets, a resource policy `Deny`.
4. Rate: first-hop precondition decides how likely, last-hop blast radius decides how bad. An attacker who needs a leaked key and gets one workload is Medium; one who needs nothing and gets the account is Critical.
5. Say what fixing the cheapest hop would do. Chains usually break at the hop that is cheapest to fix, which is a better recommendation than fixing everything.

## Mapping notes

- ATT&CK technique IDs above are for ATT&CK for Cloud (IaaS). Cite a technique only when a finding actually corresponds to it, and use the sub-technique when one applies.
- Security Hub CSPM control IDs for these chains can be looked up in `security-hub-controls.md` (for example, controls for public snapshots, root keys, and unauthenticated function URLs). Never cite an ID you did not verify there.
