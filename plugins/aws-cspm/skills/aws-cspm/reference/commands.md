# Read-only command catalog

Every command here is a `describe-*`, `list-*`, or `get-*` call that returns configuration, not data or secrets (plus `iam generate-credential-report`, which creates a report and changes no resource). This file is the allowlist. If a call is not in a code block below, do not run it without the user's say-so, and never run anything on the never-run list in `SKILL.md`. When the skill is installed as a plugin, a hook enforces this list for `aws` calls and blocks everything else.

Examples use bash. On Windows, run them in Git Bash or WSL; the redirects, `$(...)` and loops are not PowerShell.

## Shell conventions

Each Bash call starts a fresh shell, so do not rely on variables or `export`s surviving between calls. Start every call that runs `aws` with the confirmed profile and the pager off, and substitute literal values for the account ID and region list:

```bash
AWS_PROFILE=<confirmed-profile> AWS_PAGER="" aws sts get-caller-identity
```

For anything that loops over regions or buckets, put the whole loop in one call:

```bash
AWS_PROFILE=<confirmed-profile> AWS_PAGER="" bash -c 'for R in $(aws ec2 describe-regions --query "Regions[].RegionName" --output text); do echo "== $R"; aws guardduty list-detectors --region "$R"; done'
```

Evidence goes in one new private directory outside any git working tree. Create it once, note the literal path, and use that path in every redirect below (shown as `<evidence-dir>`):

```bash
mktemp -d -t cspm-evidence.XXXXXX
```

Pass `--region` explicitly on every regional call; a profile's default region silently hides the rest. Record the result of every call using the states in the next section.

## Setup, once per session

```bash
aws configure list-profiles
aws sts get-caller-identity
aws ec2 describe-regions --query 'Regions[].RegionName' --output text
aws iam list-account-aliases
aws account get-alternate-contact --alternate-contact-type SECURITY
```

`describe-regions` returns enabled regions only. Show the user the `get-caller-identity` output and get a yes before anything else. `list-profiles` lists names only; never run `aws configure list`.

## Reading call results

A call has one of five outcomes. Only the first two are evidence about the account.

| State | What it looks like | How to report it |
|---|---|---|
| Checked | Returned data | Use it |
| Not configured | An authorized call returned one of the "absent" errors below | Checked. The feature is off or unset, and that is usually the finding |
| AccessDenied | `AccessDenied`, `AccessDeniedException`, `UnauthorizedOperation`, `Client.UnauthorizedOperation`, or an explicit-deny message | Coverage gap. Never summarize the domain as healthy |
| Throttled | `Throttling`, `ThrottlingException`, `RequestLimitExceeded`, `TooManyRequestsException` | Retry with backoff first (sleep, then pace regional loops). If it still fails, coverage gap |
| Not applicable | `OptInRequired`, `AuthFailure` on a region that is not enabled, a service not offered in the region | Not applicable |

"Absent" errors that mean not configured, not broken:

| Error | Call | Meaning |
|---|---|---|
| `NoSuchPublicAccessBlockConfiguration` | `s3api`/`s3control get-public-access-block` | No Block Public Access set at that level |
| `NoSuchBucketPolicy` | `s3api get-bucket-policy` | No bucket policy |
| `NoSuchTagSet` | `s3api get-bucket-tagging` | No tags |
| `NoSuchWebsiteConfiguration` | `s3api get-bucket-website` | Not a static website |
| `OwnershipControlsNotFoundError` | `s3api get-bucket-ownership-controls` | Ownership controls unset (ACLs may be live) |
| `ServerSideEncryptionConfigurationNotFoundError` | `s3api get-bucket-encryption` | Rare now; default SSE-S3 applies to new objects |
| `NoSuchEntity` | `iam get-account-password-policy` | No custom password policy |
| `ResourceNotFoundException` | `lambda get-function-url-config`, `lambda get-policy` | No function URL, or no resource policy |
| `RepositoryPolicyNotFoundException` | `ecr get-repository-policy` | No repository policy |
| `InvalidAccessException` | `securityhub describe-hub` | Security Hub CSPM not enabled in that region |
| `NoSuchConfigurationRecorderException` or an empty recorder list | `configservice` | Config not recording |
| `UnsupportedOperationException` | `kms get-key-rotation-status` | Key type does not support rotation (asymmetric, imported, or AWS-managed), not a failure |
| `ReportInProgress` / `ReportNotPresent` | `iam get-credential-report` | Not an absence: wait and retry (see section 1) |

If an error is not in these two tables, treat it as a gap and say what it was.

---

## 1. IAM and identity (global, except Access Analyzer)

```bash
aws iam get-account-summary --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent,Users:Users,Roles:Roles}'
aws iam generate-credential-report
aws iam get-credential-report --query Content --output text | base64 -d > <evidence-dir>/cred-report.csv
aws iam get-account-password-policy
aws iam get-account-authorization-details --filter User Role Group LocalManagedPolicy > <evidence-dir>/iam-authz.json
aws iam list-open-id-connect-providers
aws iam list-saml-providers
aws accessanalyzer list-analyzers --region "$R"
aws accessanalyzer list-findings-v2 --region "$R" --analyzer-arn <arn> --filter '{"status":{"eq":["ACTIVE"]}}'
```

`generate-credential-report` is asynchronous. Poll `get-credential-report` every few seconds until it stops returning `ReportInProgress` (give up after about a minute and record a gap). `get-account-authorization-details` is heavily rate-limited and slow in large accounts: run it once, expect throttling, and back off rather than looping.

Read:

- **Root:** `RootKeys` of `1` is an active root access key. `RootMFA` of `0` is root without MFA. The credential report's `<root_account>` row shows `password_last_used` and key last-used dates.
- **Users:** in `cred-report.csv`, console users with `mfa_active` false; access keys older than 90 days (`access_key_N_last_rotated`); keys never used (`access_key_N_last_used_date` is `N/A`); users with both a console password and keys. The report gives last-used **region and service** for keys, not source IP, so it cannot show use "from unexpected places". Note that MFA on a user does not protect their access keys; it only matters for API calls if a policy requires `aws:MultiFactorAuthPresent`.
- **Policies** in `iam-authz.json`: statements with `Effect: Allow` and `Action: "*"` on `Resource: "*"`; `iam:PassRole` on `*`; `iam:*`, `sts:AssumeRole` on `*`; `NotAction` with Allow. Privilege-escalation combinations (see attack path 5) matter more than any one action.
- **Role trust policies** (`AssumeRolePolicyDocument` in the same file): `Principal: "*"` or `{"AWS":"*"}` with no `Condition`; another account's root as principal with no `sts:ExternalId` condition (third-party access); an OIDC provider such as `token.actions.githubusercontent.com` whose trust policy has no `sub` (and ideally `aud`) condition, which lets any repository on that provider assume the role.
- **Access Analyzer** is regional. Loop `$R` over every enabled region. An empty `list-analyzers` in a region means no analyzer there, which is a gap. If one exists, `list-findings-v2` lists externally reachable resources AWS already computed.

Not a finding on its own: a policy with `"*"` actions attached only to a break-glass role with MFA-enforcing conditions; AWS-managed policies (the `LocalManagedPolicy` filter is deliberate; judge AWS-managed ones by what they grant, not that they exist).

## 2. S3 (list is global; per-bucket calls follow the bucket's region)

```bash
aws s3control get-public-access-block --account-id <account-id>
aws s3api list-buckets --query 'Buckets[].[Name,BucketRegion]' --output text
# per bucket B (use --region <BucketRegion> if a call reports a redirect):
aws s3api get-public-access-block --bucket "$B"
aws s3api get-bucket-policy-status --bucket "$B"
aws s3api get-bucket-policy --bucket "$B"
aws s3api get-bucket-acl --bucket "$B"
aws s3api get-bucket-ownership-controls --bucket "$B"
aws s3api get-bucket-website --bucket "$B"
aws s3api get-bucket-versioning --bucket "$B"
aws s3api get-bucket-logging --bucket "$B"
aws s3api get-bucket-encryption --bucket "$B"
aws s3api get-bucket-tagging --bucket "$B"
```

Read:

- **Exposure needs the whole chain.** A bucket is publicly readable only if a policy or ACL grants it **and** neither the bucket-level nor the account-level Block Public Access setting neutralizes it. `get-bucket-policy-status` `IsPublic: true` is AWS's computed answer **for policies only**; it ignores ACLs, so check `get-bucket-acl` for grants to `AllUsers` or `AuthenticatedUsers` (the second means any AWS account holder) unless ownership controls are `BucketOwnerEnforced`. `RestrictPublicBuckets` enforced at the account level ignores public policies for non-AWS-service principals.
- **Policies:** `Principal: "*"` (or `{"AWS":"*"}`) with `Allow` and no restrictive `Condition` (`aws:SourceVpce`, `aws:SourceIp`, `aws:PrincipalOrgID`, `aws:SourceArn`, `aws:SourceAccount`); write or delete actions for broad principals; `s3:*`. A missing TLS-only (`aws:SecureTransport`) deny is a Low.
- **Sensitivity:** bucket names and tags hint at contents (exports, backups, invoices, logs). Say that this is an inference. Do not list or fetch objects.
- **Intent:** a bucket with website hosting enabled (`get-bucket-website` returns a config) and a public read policy is probably meant to be public. That makes it "Needs verification", not a finding.
- **Logging buckets:** the bucket that holds CloudTrail or access logs should block public access, restrict writes to the logging service, and ideally have versioning and Object Lock.

Not a finding: missing default encryption (SSE-S3 is applied to all new objects by default, so "bucket not encrypted" is almost always a stale scanner rule; judge key choice, not existence); ACLs on buckets with `BucketOwnerEnforced` ownership (ACLs are disabled); a public bucket that is clearly a static website or a published dataset, which is "Needs verification" until intent is confirmed.

## 3. Compute, network exposure, and data stores (regional, loop `$R`)

```bash
# --- Security groups: every group that opens to the internet
aws ec2 describe-security-groups --region "$R" --filters Name=ip-permission.cidr,Values=0.0.0.0/0 \
  --query 'SecurityGroups[].{Id:GroupId,Name:GroupName,Ports:IpPermissions[?contains(IpRanges[].CidrIp, `0.0.0.0/0`)].[IpProtocol,FromPort,ToPort]}'
aws ec2 describe-security-groups --region "$R" --filters Name=ip-permission.ipv6-cidr,Values=::/0

# --- Which of them are actually reachable: instances/ENIs with public addresses, and public subnets
aws ec2 describe-network-interfaces --region "$R" \
  --query 'NetworkInterfaces[?Association.PublicIp].{Eni:NetworkInterfaceId,Ip:Association.PublicIp,Sg:Groups[].GroupId,Subnet:SubnetId,Owner:Description}'
aws ec2 describe-addresses --region "$R"
aws ec2 describe-route-tables --region "$R" \
  --query "RouteTables[?Routes[?GatewayId && starts_with(GatewayId,'igw-')]].{Rt:RouteTableId,Subnets:Associations[].SubnetId,Main:Associations[?Main].Main}"
aws ec2 describe-network-acls --region "$R"

# --- Instances: public address, IMDS settings, attached identity
aws ec2 describe-instances --region "$R" \
  --query 'Reservations[].Instances[].{Id:InstanceId,Pub:PublicIpAddress,Subnet:SubnetId,IMDS:MetadataOptions.HttpTokens,Hop:MetadataOptions.HttpPutResponseHopLimit,Profile:IamInstanceProfile.Arn,State:State.Name}'
aws ec2 get-instance-metadata-defaults --region "$R"

# --- Storage that can be shared publicly
aws ec2 get-ebs-encryption-by-default --region "$R"
aws ec2 get-snapshot-block-public-access-state --region "$R"
aws ec2 get-image-block-public-access-state --region "$R"
aws ec2 describe-snapshots --region "$R" --owner-ids self --restorable-by-user-ids all
aws ec2 describe-images --region "$R" --owners self --filters Name=is-public,Values=true

# --- Load balancers and WAF
aws elbv2 describe-load-balancers --region "$R" --query 'LoadBalancers[].{Arn:LoadBalancerArn,Scheme:Scheme,Sg:SecurityGroups}'
aws elbv2 describe-listeners --region "$R" --load-balancer-arn <arn>
aws wafv2 list-web-acls --scope REGIONAL --region "$R"

# --- Databases and clusters
aws rds describe-db-instances --region "$R" \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Public:PubliclyAccessible,Enc:StorageEncrypted,Backup:BackupRetentionPeriod,Del:DeletionProtection,Engine:Engine,Cluster:DBClusterIdentifier}'
aws rds describe-db-clusters --region "$R" \
  --query 'DBClusters[].{Id:DBClusterIdentifier,Enc:StorageEncrypted,Backup:BackupRetentionPeriod,Del:DeletionProtection,Engine:Engine}'
aws rds describe-db-snapshots --region "$R" --snapshot-type manual --query 'DBSnapshots[].DBSnapshotIdentifier' --output text
aws rds describe-db-snapshot-attributes --region "$R" --db-snapshot-identifier <id>
aws rds describe-db-cluster-snapshots --region "$R" --snapshot-type manual --query 'DBClusterSnapshots[].DBClusterSnapshotIdentifier' --output text
aws rds describe-db-cluster-snapshot-attributes --region "$R" --db-cluster-snapshot-identifier <id>
aws redshift describe-clusters --region "$R" \
  --query 'Clusters[].{Id:ClusterIdentifier,Public:PubliclyAccessible,Enc:Encrypted,Vpc:VpcId,Sg:VpcSecurityGroups[].VpcSecurityGroupId}'
aws opensearch list-domain-names --region "$R"
aws opensearch describe-domain --region "$R" --domain-name <name> \
  --query 'DomainStatus.{Vpc:VPCOptions.VPCId,Policy:AccessPolicies,Enc:EncryptionAtRestOptions.Enabled,N2N:NodeToNodeEncryptionOptions.Enabled,Https:DomainEndpointOptions.EnforceHTTPS,FGAC:AdvancedSecurityOptions.Enabled}'
aws efs describe-file-systems --region "$R" --query 'FileSystems[].{Id:FileSystemId,Enc:Encrypted}'
aws efs describe-file-system-policy --region "$R" --file-system-id <id>
aws eks list-clusters --region "$R"
aws eks describe-cluster --region "$R" --name <name> \
  --query 'cluster.{PublicEndpoint:resourcesVpcConfig.endpointPublicAccess,Cidrs:resourcesVpcConfig.publicAccessCidrs,Logging:logging.clusterLogging}'
aws ec2 describe-flow-logs --region "$R"
```

Read:

- **An open security group is not an exposure by itself.** Join the pieces: group to ENI/instance, then does it have a public IP (or sit behind an internet-facing load balancer), then is its subnet associated with a route table that has an `igw-` route (or is it the VPC's main table with such a route), then do the NACLs allow it. Open to `0.0.0.0/0` on 22/3389/database ports to a reachable host is the real finding. An open group on an instance in a private subnet with only a NAT route is, at most, internal exposure (Low to Medium, depends on what else can reach that VPC).
- **Ports:** 22, 3389, 5432, 3306, 1433, 6379, 27017, 9200, 2375 reachable from the internet are the usual suspects. 80/443 on a load balancer is normal.
- **IMDS:** `IMDS` of `optional` means IMDSv1 is allowed. It matters when something can be made to issue a request on the instance's behalf (SSRF), and matters most when `Profile` carries a powerful role. `Hop` of `1` stops containers from reaching IMDS under IMDSv2.
- **Public snapshots/AMIs:** `--restorable-by-user-ids all` returning anything is a Critical candidate; check what the snapshot holds from tags and source volume before rating.
- **RDS and Aurora:** `PubliclyAccessible: true` only matters if the instance's subnet routes to an internet gateway and its security group admits the world. `Backup` of `0` disables automated backups. A manual snapshot (instance or cluster) whose `restore` attribute includes `all` is public. Aurora snapshots only appear in the `cluster-snapshot` calls.
- **Redshift:** same test as RDS: `PubliclyAccessible` plus a routable subnet plus an open security group.
- **OpenSearch:** the real exposure is a domain with no `Vpc` (public endpoint) and an access policy with `Principal: "*"` and no `Condition`, or fine-grained access control off. Read `Policy` as JSON. A VPC domain is internal exposure only.
- **EFS:** a file system policy with `Principal: "*"` and no condition, on a file system whose mount targets are reachable, is the finding. `Enc` false is hygiene.
- **EKS:** `PublicEndpoint: true` with `Cidrs` of `0.0.0.0/0` exposes the API server to the internet; authentication still applies, so rate by what that endpoint's identity layer allows and whether control-plane logging is on.
- **Flow logs** absent on a VPC is a detection gap (Low to Medium), not an exposure.

Not a finding: default security groups with no rules; an internet-facing load balancer in front of a public web tier that is meant to be public, unless it terminates plain HTTP with no redirect; IMDSv1 on an instance with no instance profile.

## 4. Edge and APIs (CloudFront, Route 53, API Gateway, Cognito)

```bash
aws cloudfront list-distributions --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Aliases:Aliases.Items,Origins:Origins.Items[].DomainName,Waf:WebACLId}'
aws route53 list-hosted-zones
aws route53 list-resource-record-sets --hosted-zone-id <id>
aws apigateway get-rest-apis --region "$R"
aws apigateway get-authorizers --region "$R" --rest-api-id <id>
aws apigatewayv2 get-apis --region "$R"
aws apigatewayv2 get-authorizers --region "$R" --api-id <id>
aws cognito-idp list-user-pools --region "$R" --max-results 60
aws cognito-idp describe-user-pool --region "$R" --user-pool-id <id> --query 'UserPool.{Mfa:MfaConfiguration,AdminOnlySignUp:AdminCreateUserConfig.AllowAdminCreateUserOnly,Deletion:DeletionProtection}'
aws cognito-identity list-identity-pools --region "$R" --max-results 60
aws cognito-identity describe-identity-pool --region "$R" --identity-pool-id <id> --query '{Unauth:AllowUnauthenticatedIdentities,Name:IdentityPoolName}'
```

Read:

- **Dangling DNS.** From `list-resource-record-sets`, flag records whose targets point at an AWS resource that no longer exists in this account: a CloudFront distribution domain not in `list-distributions`, an S3 website endpoint for a bucket not in `list-buckets`, an Elastic IP not in `describe-addresses`. Anyone could recreate that resource and serve content on your hostname. Decide from configuration only; do not resolve or fetch the hostname. A target outside the account is "Needs verification".
- **Cognito identity pools** with `Unauth: true` hand out AWS credentials to anonymous users. Rate by what the unauthenticated role allows (read it in `iam-authz.json`). A user pool with `AdminOnlySignUp` false (self sign-up open) and MFA off matters only if the app grants access on sign-up.
- **API Gateway:** a route or method with no authorizer and no API key requirement is a public endpoint; rate by what the integration does and the role it carries. Check `get-authorizers` and the stage's WAF association before asserting.
- **CloudFront:** no WAF is a hardening note, not a finding, unless the origin is also directly reachable.

## 5. Logging and detection (CloudTrail and IAM are global; the rest are regional)

```bash
aws cloudtrail describe-trails --include-shadow-trails \
  --query 'trailList[].{Name:Name,Arn:TrailARN,Multi:IsMultiRegionTrail,Org:IsOrganizationTrail,Validation:LogFileValidationEnabled,KMS:KmsKeyId,Bucket:S3BucketName,Home:HomeRegion}'
aws cloudtrail get-trail-status --name <trail-arn>
aws cloudtrail get-event-selectors --trail-name <trail-arn>
aws guardduty list-detectors --region "$R"
aws guardduty get-detector --region "$R" --detector-id <id>
aws securityhub describe-hub --region "$R"
aws securityhub get-enabled-standards --region "$R"
aws securityhub get-findings --region "$R" --filters '{"ComplianceSecurityControlId":[{"Value":"S3.1","Comparison":"EQUALS"}],"RecordState":[{"Value":"ACTIVE","Comparison":"EQUALS"}]}'
aws configservice describe-configuration-recorders --region "$R"
aws configservice describe-configuration-recorder-status --region "$R"
aws logs describe-metric-filters --region "$R" --query 'metricFilters[].{Group:logGroupName,Name:filterName,Pattern:filterPattern,Metric:metricTransformations[0].metricName}'
aws cloudwatch describe-alarms --region "$R" --query 'MetricAlarms[].{Name:AlarmName,Metric:MetricName,Ns:Namespace,Actions:AlarmActions}'
aws events list-rules --region "$R" --query 'Rules[].{Name:Name,State:State,Pattern:EventPattern}'
```

Read:

- **CloudTrail:** a multi-region trail with `IsLogging: true`, log file validation on, and a protected destination bucket is the baseline. With no trail you still have 90 days of management-event history in the console, so describe the gap as "no durable, queryable, tamper-evident record", not "no logging". Check the destination bucket with section 2's calls. Data events and CloudTrail Lake are optional signals. Use the trail ARN (not the name) for `get-trail-status` and `get-event-selectors` so organization and shadow trails work.
- **GuardDuty and Security Hub CSPM** must be enabled per region (or via an organization delegated admin). A region with a detector disabled is a hole an attacker can use quietly. Cross-check with section 3: a region with no GuardDuty and running workloads is worse than an empty region. Security Hub coverage depends on which standards and regions are enabled, which is itself worth reporting.
- **Config recorder:** off or partial recording undermines every Config-based control and any later forensics.
- **Alerting:** to say anything about alerts on root use, console sign-in without MFA, IAM policy changes, CloudTrail changes, or security group changes, look for a metric filter whose `Pattern` matches that event, a CloudWatch alarm on that metric with `Actions` set, or an EventBridge rule whose `Pattern` matches it. Names alone do not tell you what is monitored. Absence is a detection gap; report it as one, and report the pattern you matched when it exists.

## 6. Encryption, keys, and secrets

```bash
aws kms list-keys --region "$R" --query 'Keys[].KeyId' --output text
aws kms describe-key --region "$R" --key-id <id> --query 'KeyMetadata.{Mgr:KeyManager,Spec:KeySpec,State:KeyState,Origin:Origin}'
aws kms get-key-rotation-status --region "$R" --key-id <id>
aws kms get-key-policy --region "$R" --key-id <id> --policy-name default
aws secretsmanager list-secrets --region "$R" --query 'SecretList[].{Name:Name,Rotation:RotationEnabled,Last:LastAccessedDate,Kms:KmsKeyId}'
aws ssm describe-parameters --region "$R" --query 'Parameters[].{Name:Name,Type:Type}'
aws acm list-certificates --region "$R"
```

Read:

- **KMS:** rotation status applies to customer-managed symmetric keys only; AWS-managed keys rotate on AWS's schedule and asymmetric or imported keys do not auto-rotate (`UnsupportedOperationException` there is expected). A key policy that grants `Principal: "*"` without a restrictive condition is a finding. A key policy that delegates to IAM (`arn:aws:iam::<acct>:root`) is normal, so go look at IAM.
- **Secrets Manager:** `Rotation` false on a long-lived credential is a hygiene finding. `list-secrets` returns metadata only; never call `get-secret-value`.
- **SSM Parameter Store:** `describe-parameters` lists names and types; `Type: String` for something named like a credential is a finding. Never call `get-parameter` or `get-parameters`, with or without decryption: plain `String` values come back in clear text.

## 7. Serverless, messaging, and registries

```bash
aws lambda list-functions --region "$R" --query 'Functions[].FunctionName' --output text
aws lambda get-function-url-config --region "$R" --function-name <fn>
aws lambda get-policy --region "$R" --function-name <fn>
aws sns list-topics --region "$R"
aws sns get-topic-attributes --region "$R" --topic-arn <arn> --query 'Attributes.Policy'
aws sqs list-queues --region "$R"
aws sqs get-queue-attributes --region "$R" --queue-url <url> --attribute-names Policy
aws ecr describe-repositories --region "$R" --query 'repositories[].{Name:repositoryName,Scan:imageScanningConfiguration.scanOnPush,Mut:imageTagMutability}'
aws ecr get-repository-policy --region "$R" --repository-name <name>
```

Read:

- **Lambda function URLs** with `AuthType: NONE` are public endpoints; the question is what the function does and what role it carries. A resource policy with `Principal: "*"` and no `aws:SourceArn`/`aws:SourceAccount` condition lets anyone invoke it.
- **SNS/SQS** policies with `Principal: "*"` and no condition are open to publish or send; check `aws:SourceArn`.
- **ECR:** mutable tags plus a pipeline that deploys by tag is a supply-chain risk; a repository policy granting `*` allows anyone to pull.
- Never call `lambda get-function` (returns a code download URL), `lambda get-function-configuration` (returns environment variable values), or `lambda invoke`.

## 8. AI workloads (Bedrock, SageMaker, AgentCore)

These map to Security Hub CSPM's AI Security Best Practices standard; the `A` rows in `security-hub-controls.md` list the controls. Confirm operation names with `aws <service> help` if your CLI version is older, since these services are new and still changing.

```bash
aws bedrock list-guardrails --region "$R"
aws bedrock get-model-invocation-logging-configuration --region "$R"
aws bedrock-agent list-agents --region "$R"
aws bedrock-agent get-agent --region "$R" --agent-id <id> --query 'agent.{Role:agentResourceRoleArn,Guardrail:guardrailConfiguration,Kms:customerEncryptionKeyArn}'
aws bedrock-agent list-knowledge-bases --region "$R"
aws bedrock-agentcore-control list-agent-runtimes --region "$R"
aws bedrock-agentcore-control get-agent-runtime --region "$R" --agent-runtime-id <id> --query '{Net:networkConfiguration,Auth:authorizerConfiguration}'
aws bedrock-agentcore-control list-gateways --region "$R"
aws sagemaker list-notebook-instances --region "$R"
aws sagemaker describe-notebook-instance --region "$R" --notebook-instance-name <n> \
  --query '{Direct:DirectInternetAccess,Root:RootAccess,Subnet:SubnetId,Kms:KmsKeyId,Role:RoleArn}'
aws sagemaker list-models --region "$R"
aws sagemaker describe-model --region "$R" --model-name <n> --query '{Iso:EnableNetworkIsolation,Vpc:VpcConfig,Role:ExecutionRoleArn}'
```

Read:

- **Agents and gateways:** an agent whose execution role is broad is the AWS form of "excessive agency"; an AgentCore gateway with no inbound authorizer is an unauthenticated tool endpoint.
- **Invocation logging** off means no record of what models were asked or returned (a detection gap). Be careful: turning it on stores prompts and responses, so recommend it with a data-handling note, not as a reflex.
- **SageMaker notebooks** with `Direct: Enabled` and `Root: Enabled` and a powerful `Role` are an internet-reachable shell holding that role.
- Never run `bedrock-runtime` calls (`invoke-model`, `converse`) as part of a review; they cost money and send data.

## 9. Organization guardrails

```bash
aws organizations describe-organization
aws organizations list-roots
aws organizations list-policies --filter SERVICE_CONTROL_POLICY
aws organizations list-targets-for-policy --policy-id <id>
aws organizations describe-policy --policy-id <id>
```

These require the management account or a delegated administrator, so `AccessDenied` from a member account is expected: report "SCPs not assessed from this account", never "no SCPs". When SCPs are readable, they are the compensating controls for step 4 of triage (region restrictions, denied `iam:CreateUser`, denied leaving the organization, denied disabling CloudTrail or GuardDuty). `list-policies` shows what exists; `list-targets-for-policy` shows where it is attached; `describe-policy` shows what it denies. All three are needed before you can call an SCP a compensating control.

## Not covered by this catalog

Say so in the brief instead of implying coverage: Macie, Inspector, Detective, IAM Identity Center, S3 access points and Multi-Region Access Points, VPC endpoint and Transit Gateway policies, DynamoDB resource policies, ElastiCache, Glue and Athena, ECS and Fargate task definitions, CodeBuild and CodePipeline, CloudFormation stacks, Systems Manager documents and associations, Directory Service, and anything in a service the account uses that is not listed above.
