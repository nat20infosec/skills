# Read-only command catalog

Every command here is a `describe-*`, `list-*`, or `get-*` call that returns configuration, not data or secrets. This is an allowlist: if a call is not in this file, do not run it without the user's say-so, and never run anything on the never-run list in `SKILL.md`. Examples use bash quoting; in PowerShell, swap the quote styles around `--query` expressions.

Setup, once per session:

```bash
export AWS_PAGER=""                       # never block on a pager
aws sts get-caller-identity               # confirm account + principal with the user first
ACCT=$(aws sts get-caller-identity --query Account --output text)
REGIONS=$(aws ec2 describe-regions --query 'Regions[].RegionName' --output text)   # enabled regions only
```

Pass `--region` explicitly on every regional call; a profile's default region silently hides the rest. Record whether each call succeeded: `AccessDenied` and throttling are gaps in the coverage table, not clean results.

---

## 1. IAM and identity (global, run once)

```bash
aws iam get-account-summary --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent,Users:Users,Roles:Roles}'
aws iam generate-credential-report        # creates a report, changes no resource
aws iam get-credential-report --query Content --output text | base64 -d > cred-report.csv
aws iam get-account-password-policy       # NoSuchEntity means no custom policy
aws iam get-account-authorization-details --filter User Role Group LocalManagedPolicy > iam-authz.json
aws iam list-account-aliases
aws iam list-open-id-connect-providers
aws iam list-saml-providers
aws accessanalyzer list-analyzers
```

Read:

- **Root:** `RootKeys` of `1` is an active root access key. `RootMFA` of `0` is root without MFA. The credential report's `<root_account>` row shows `password_last_used` and key last-used dates.
- **Users:** in `cred-report.csv`, console users with `mfa_active` false; access keys older than 90 days (`access_key_N_last_rotated`); keys never used (`access_key_N_last_used_date` is `N/A`); users with both a console password and keys.
- **Policies** in `iam-authz.json`: statements with `Effect: Allow` and `Action: "*"` on `Resource: "*"`; `iam:PassRole` on `*`; `iam:*`, `sts:AssumeRole` on `*`; `NotAction` with Allow. Privilege-escalation combinations (PassRole plus a compute-create action, `iam:CreatePolicyVersion`, `iam:AttachUserPolicy`) matter more than any one action.
- **Role trust policies** (`AssumeRolePolicyDocument` in the same file): `Principal: "*"` or `{"AWS":"*"}` with no `Condition`; another account's root as principal with no `sts:ExternalId` condition (third-party access); an OIDC provider such as `token.actions.githubusercontent.com` whose trust policy has no `sub` (and ideally `aud`) condition, which lets any repository on that provider assume the role.
- **Access Analyzer:** if `list-analyzers` is empty, there is no analyzer in that region, which is a gap. If one exists, `aws accessanalyzer list-findings-v2 --analyzer-arn <arn> --filter '{"status":{"eq":["ACTIVE"]}}'` lists externally reachable resources AWS has already computed.

Not a finding on its own: a policy with `"*"` actions attached only to a break-glass role with MFA-enforcing conditions; AWS-managed policies (list is `--filter LocalManagedPolicy` for a reason; judge AWS-managed ones by what they grant, not that they exist).

## 2. S3 (list is global; per-bucket calls follow the bucket's region)

```bash
aws s3control get-public-access-block --account-id "$ACCT"      # NoSuchPublicAccessBlockConfiguration = not set
aws s3api list-buckets --query 'Buckets[].Name' --output text
# per bucket B:
aws s3api get-public-access-block --bucket "$B"
aws s3api get-bucket-policy-status --bucket "$B"                 # IsPublic
aws s3api get-bucket-policy --bucket "$B"
aws s3api get-bucket-ownership-controls --bucket "$B"
aws s3api get-bucket-versioning --bucket "$B"
aws s3api get-bucket-logging --bucket "$B"
aws s3api get-bucket-encryption --bucket "$B"
aws s3api get-bucket-tagging --bucket "$B"
```

Read:

- **Exposure needs the whole chain.** A bucket is publicly readable only if a policy or ACL grants it **and** neither the bucket-level nor the account-level Block Public Access setting neutralizes it. `get-bucket-policy-status` `IsPublic: true` is AWS's own computed answer; start there. `RestrictPublicBuckets` enforced at the account level ignores public policies for non-AWS-service principals.
- **Policies:** `Principal: "*"` (or `{"AWS":"*"}`) with `Allow` and no restrictive `Condition` (`aws:SourceVpce`, `aws:SourceIp`, `aws:PrincipalOrgID`, `aws:SourceArn`, `aws:SourceAccount`); write or delete actions for broad principals; `s3:*`. A missing TLS-only (`aws:SecureTransport`) deny is a Low.
- **Sensitivity:** bucket names and tags hint at contents (exports, backups, invoices, logs). Say that this is an inference. Do not list or fetch objects.
- **Logging buckets:** the bucket that holds CloudTrail or access logs should block public access, restrict writes to the logging service, and ideally have versioning and Object Lock.

Not a finding: missing default encryption (SSE-S3 is applied to all new objects by default, so "bucket not encrypted" is almost always a stale scanner rule; judge key choice, not existence); ACLs on buckets with `BucketOwnerEnforced` ownership (ACLs are disabled); a public bucket that is clearly a static website or a published dataset, which is "Needs verification" until intent is confirmed.

## 3. Compute, network exposure, and data stores (regional, loop `$REGIONS`)

```bash
# --- Security groups: every group that opens to the internet
aws ec2 describe-security-groups --region "$R" --filters Name=ip-permission.cidr,Values=0.0.0.0/0 \
  --query 'SecurityGroups[].{Id:GroupId,Name:GroupName,Ports:IpPermissions[?contains(IpRanges[].CidrIp, `0.0.0.0/0`)].[IpProtocol,FromPort,ToPort]}'
aws ec2 describe-security-groups --region "$R" --filters Name=ip-permission.ipv6-cidr,Values=::/0

# --- Which of them are actually reachable: instances/ENIs with public addresses, and public subnets
aws ec2 describe-network-interfaces --region "$R" \
  --query 'NetworkInterfaces[?Association.PublicIp].{Eni:NetworkInterfaceId,Ip:Association.PublicIp,Sg:Groups[].GroupId,Subnet:SubnetId,Owner:Description}'
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
aws ec2 describe-snapshots --region "$R" --owner-ids self --restorable-by-user-ids all     # publicly restorable
aws ec2 describe-images --region "$R" --owners self --filters Name=is-public,Values=true    # public AMIs

# --- Load balancers and WAF
aws elbv2 describe-load-balancers --region "$R" --query 'LoadBalancers[].{Arn:LoadBalancerArn,Scheme:Scheme,Sg:SecurityGroups}'
aws elbv2 describe-listeners --region "$R" --load-balancer-arn <arn>
aws wafv2 list-web-acls --scope REGIONAL --region "$R"

# --- Databases and clusters
aws rds describe-db-instances --region "$R" \
  --query 'DBInstances[].{Id:DBInstanceIdentifier,Public:PubliclyAccessible,Enc:StorageEncrypted,Backup:BackupRetentionPeriod,Del:DeletionProtection,Engine:Engine}'
aws rds describe-db-snapshots --region "$R" --snapshot-type manual --query 'DBSnapshots[].DBSnapshotIdentifier' --output text
aws rds describe-db-snapshot-attributes --region "$R" --db-snapshot-identifier <id>          # restore attr containing "all" = public
aws eks describe-cluster --region "$R" --name <name> \
  --query 'cluster.{PublicEndpoint:resourcesVpcConfig.endpointPublicAccess,Cidrs:resourcesVpcConfig.publicAccessCidrs,Logging:logging.clusterLogging}'
aws ec2 describe-flow-logs --region "$R"
```

Read:

- **An open security group is not an exposure by itself.** Join the pieces: group → ENI/instance → does it have a public IP (or sit behind an internet-facing load balancer) → is its subnet associated with a route table that has an `igw-` route (or is it the VPC's main table with such a route) → do the NACLs allow it. Open to `0.0.0.0/0` on 22/3389/database ports to a reachable host is the real finding. An open group on an instance in a private subnet with only a NAT route is, at most, internal exposure (Low to Medium, depends on what else can reach that VPC).
- **Ports:** 22, 3389, 5432, 3306, 1433, 6379, 27017, 9200, 2375 reachable from the internet are the usual suspects. 80/443 on a load balancer is normal.
- **IMDS:** `IMDS` of `optional` means IMDSv1 is allowed. It matters when something can be made to issue a request on the instance's behalf (SSRF), and matters most when `Profile` carries a powerful role. `Hop` of `1` stops containers from reaching IMDS under IMDSv2.
- **Public snapshots/AMIs:** `--restorable-by-user-ids all` returning anything is a Critical candidate; check what the snapshot holds from tags and source volume before rating.
- **RDS:** `PubliclyAccessible: true` only matters if the instance's subnet routes to an internet gateway and its security group admits the world. `Backup` of `0` disables automated backups. A manual snapshot whose `restore` attribute includes `all` is public.
- **EKS:** `PublicEndpoint: true` with `Cidrs` of `0.0.0.0/0` exposes the API server to the internet; authentication still applies, so rate by what that endpoint's identity layer allows and whether control-plane logging is on.
- **Flow logs** absent on a VPC is a detection gap (Low to Medium), not an exposure.

Not a finding: default security groups with no rules; an internet-facing load balancer in front of a public web tier that is meant to be public, unless it terminates plain HTTP with no redirect; IMDSv1 on an instance with no instance profile.

## 4. Logging and detection (CloudTrail and IAM are global; the rest are regional)

```bash
aws cloudtrail describe-trails --include-shadow-trails \
  --query 'trailList[].{Name:Name,Multi:IsMultiRegionTrail,Org:IsOrganizationTrail,Validation:LogFileValidationEnabled,KMS:KmsKeyId,Bucket:S3BucketName,Home:HomeRegion}'
aws cloudtrail get-trail-status --name <trail>                      # IsLogging, LatestDeliveryError
aws cloudtrail get-event-selectors --trail-name <trail>
aws guardduty list-detectors --region "$R"                          # empty = not enabled in this region
aws guardduty get-detector --region "$R" --detector-id <id>
aws securityhub describe-hub --region "$R"                          # error InvalidAccessException = not enabled
aws securityhub get-enabled-standards --region "$R"
aws configservice describe-configuration-recorders --region "$R"
aws configservice describe-configuration-recorder-status --region "$R"
aws cloudwatch describe-alarms --region "$R" --query 'MetricAlarms[].AlarmName'
aws events list-rules --region "$R" --query 'Rules[].Name'
```

Read:

- **CloudTrail:** a multi-region trail with `IsLogging: true`, log file validation on, and a protected destination bucket is the baseline. With no trail you still have 90 days of management-event history in the console, so describe the gap as "no durable, queryable, tamper-evident record", not "no logging". Check the destination bucket with section 2's calls. Data events and CloudTrail Lake are optional signals.
- **GuardDuty and Security Hub CSPM** must be enabled per region (or via an organization delegated admin). A region with a detector disabled is a hole an attacker can use quietly. Cross-check with section 3: a region with no GuardDuty and running workloads is worse than an empty region.
- **Config recorder:** off or partial recording undermines every Config-based control and any later forensics.
- **Alarms/rules:** whether anything is wired to alert on root use, console sign-in without MFA, IAM policy changes, CloudTrail changes, and security group changes. Absence is a detection gap; report it as one.

## 5. Encryption, keys, and secrets

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

- **KMS:** rotation status applies to customer-managed symmetric keys only; AWS-managed keys rotate on AWS's schedule and asymmetric or imported keys do not auto-rotate. A key policy that grants `Principal: "*"` without a restrictive condition is a finding. A key policy that delegates to IAM (`arn:aws:iam::<acct>:root`) is normal, so go look at IAM.
- **Secrets Manager:** `Rotation` false on a long-lived credential is a hygiene finding. `list-secrets` returns metadata only; never call `get-secret-value`.
- **SSM Parameter Store:** `describe-parameters` lists names and types; `Type: String` for something named like a credential is a finding. Never fetch values.

## 6. Serverless, messaging, and registries

```bash
aws lambda list-functions --region "$R" --query 'Functions[].FunctionName' --output text
aws lambda get-function-url-config --region "$R" --function-name <fn>      # ResourceNotFoundException = none
aws lambda get-policy --region "$R" --function-name <fn>                   # resource policy, not code
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
- Never call `lambda get-function` (returns a code download URL) or `lambda invoke`.

## 7. AI workloads (Bedrock, SageMaker, AgentCore)

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

- **Agents and gateways:** an agent whose execution role is broad is the AWS form of "excessive agency"; an AgentCore gateway with no inbound authorizer is an unauthenticated tool endpoint. Cross-reference with the OWASP Agentic Top 10 if the `owasp-security` skill is installed.
- **Invocation logging** off means no record of what models were asked or returned (a detection gap). Be careful: turning it on stores prompts and responses, so recommend it with a data-handling note, not as a reflex.
- **SageMaker notebooks** with `Direct: Enabled` and `Root: Enabled` and a powerful `Role` are an internet-reachable shell holding that role.
- Never run `bedrock-runtime` calls (`invoke-model`, `converse`) as part of a review; they cost money and send data.

## 8. Organization guardrails

```bash
aws organizations describe-organization
aws organizations list-policies --filter SERVICE_CONTROL_POLICY
aws organizations list-roots
```

These require the management account or a delegated administrator, so `AccessDenied` from a member account is expected: report "SCPs not assessed from this account", never "no SCPs". When SCPs are readable, they are the compensating controls for step 4 of triage (region restrictions, denied `iam:CreateUser`, denied leaving the organization, denied disabling CloudTrail or GuardDuty).
