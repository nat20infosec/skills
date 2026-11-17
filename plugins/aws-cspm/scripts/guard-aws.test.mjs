// Offline tests for the aws-cspm guard. Run: node --test plugins/aws-cspm/scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { CATALOG, evaluate, loadAllowlist, findAwsCalls } from "./guard-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const allow = loadAllowlist();
const blocked = (cmd) => evaluate(cmd, allow).length > 0;

test("a CRLF catalog (Windows checkout with core.autocrlf) yields the same allowlist", () => {
  const dir = mkdtempSync(join(tmpdir(), "guard-crlf-"));
  try {
    const crlf = join(dir, "commands.md");
    writeFileSync(crlf, readFileSync(CATALOG, "utf8").replace(/\r?\n/g, "\r\n"));
    const fromCrlf = loadAllowlist(crlf);
    assert.ok(fromCrlf.size > 100, `CRLF catalog parsed to only ${fromCrlf.size} pairs`);
    assert.deepEqual([...fromCrlf].sort(), [...allow].sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("catalog yields a sensible allowlist", () => {
  assert.ok(allow.size > 100, `only ${allow.size} pairs parsed`);
  for (const pair of ["sts get-caller-identity", "iam generate-credential-report", "s3api get-bucket-acl",
    "eks list-clusters", "rds describe-db-cluster-snapshots", "configure list-profiles", "securityhub get-findings"]) {
    assert.ok(allow.has(pair), `missing ${pair}`);
  }
});

test("catalog never contains a forbidden operation", () => {
  const forbidden = ["secretsmanager get-secret-value", "ssm get-parameter", "ssm get-parameters",
    "ec2 get-password-data", "ecr get-login-password", "ecr get-authorization-token", "lambda get-function",
    "lambda get-function-configuration", "lambda invoke", "s3api get-object", "logs get-log-events",
    "logs filter-log-events", "dynamodb scan", "athena start-query-execution", "sts assume-role", "kms decrypt"];
  for (const f of forbidden) assert.ok(!allow.has(f), `${f} is in the catalog`);
});

test("allows catalog commands, with env prefixes, global options, pipes and loops", () => {
  const ok = [
    "aws sts get-caller-identity",
    'AWS_PROFILE=audit-ro AWS_PAGER="" aws s3api list-buckets --query \'Buckets[].[Name,BucketRegion]\' --output text',
    "aws --profile audit-ro --region us-east-1 ec2 describe-instances --query 'Reservations[].Instances[].InstanceId'",
    "aws iam get-credential-report --query Content --output text | base64 -d > /tmp/x/cred-report.csv",
    `AWS_PROFILE=p bash -c 'for R in $(aws ec2 describe-regions --query "Regions[].RegionName" --output text); do aws guardduty list-detectors --region "$R"; done'`,
    "aws ec2 help",
    "aws --version",
    "ls -la && git status",
    "echo hello",
  ];
  for (const c of ok) assert.deepEqual(evaluate(c, allow), [], c);
});

test("blocks reads of secrets, data, and code", () => {
  const bad = [
    "aws secretsmanager get-secret-value --secret-id prod/db",
    "aws ssm get-parameter --name /prod/db/password",
    "aws ssm get-parameters --names a b --with-decryption",
    "aws ec2 get-password-data --instance-id i-1",
    "aws lambda get-function --function-name f",
    "aws lambda get-function-configuration --function-name f",
    "aws logs filter-log-events --log-group-name g",
    "aws s3api get-object --bucket b --key k out",
    "aws s3 cp s3://b/k .",
    "aws s3 ls s3://b",
    "aws dynamodb scan --table-name t",
    "aws kms decrypt --ciphertext-blob fileb://x",
    "aws ecr get-login-password",
  ];
  for (const c of bad) assert.ok(blocked(c), c);
});

test("blocks mutations and credential issuing", () => {
  const bad = [
    "aws iam create-access-key --user-name admin",
    "aws iam attach-user-policy --user-name u --policy-arn arn:aws:iam::aws:policy/AdministratorAccess",
    "aws guardduty create-detector --enable",
    "aws s3api put-bucket-policy --bucket b --policy file://p.json",
    "aws ec2 terminate-instances --instance-ids i-1",
    "aws sts assume-role --role-arn arn:aws:iam::1:role/r --role-session-name s",
    "aws configure list",
    "aws configure export-credentials",
  ];
  for (const c of bad) assert.ok(blocked(c), c);
});

test("blocks wrappers and chaining that smuggle a bad call", () => {
  const bad = [
    'bash -c "aws s3 rm s3://b --recursive"',
    "sh -c 'aws iam create-user --user-name x'",
    "aws sts get-caller-identity && aws iam delete-user --user-name x",
    "aws ec2 describe-instances; aws ec2 run-instances --image-id ami-1",
    "echo $(aws secretsmanager get-secret-value --secret-id s)",
    "aws --profile p iam create-role --role-name r",
    "aws --region us-east-1 s3 sync . s3://b",
    "AWS_PROFILE=p aws.exe iam create-user --user-name x",
  ];
  for (const c of bad) assert.ok(blocked(c), c);
});

test("blocks reading local credential material", () => {
  for (const c of ["cat ~/.aws/credentials", "cat ~/.aws/config", "ls ~/.aws/sso/cache", "echo $AWS_SECRET_ACCESS_KEY",
    "type %USERPROFILE%\\.aws\\credentials"]) {
    assert.ok(blocked(c), c);
  }
});

test("prowler must exclude checks", () => {
  assert.ok(blocked("prowler aws --profile audit-ro"));
  assert.ok(!blocked("prowler aws --profile audit-ro --excluded-checks awslambda_function_no_secrets_in_code"));
  assert.ok(!blocked("prowler aws --list-checks"), "listing checks is harmless but is allowed so the secret-scanning checks can be found");
});

test("findAwsCalls parses service and operation past global options", () => {
  const [c] = findAwsCalls("aws --profile x --region us-east-1 --no-cli-pager ec2 describe-regions");
  assert.equal(c.svc, "ec2");
  assert.equal(c.op, "describe-regions");
});

test("hook entry point: exit codes and stderr", () => {
  const run = (command, tool_name = "Bash") =>
    spawnSync(process.execPath, [join(here, "guard-aws.mjs")], {
      input: JSON.stringify({ tool_name, tool_input: { command } }),
      encoding: "utf8",
    });
  const good = run("aws sts get-caller-identity");
  assert.equal(good.status, 0);
  const bad = run("aws iam create-access-key --user-name admin");
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /not in reference\/commands\.md/);
  assert.equal(run("aws iam create-access-key", "Read").status, 0, "non-Bash tools are ignored");
  const garbage = spawnSync(process.execPath, [join(here, "guard-aws.mjs")], { input: "not json", encoding: "utf8" });
  assert.equal(garbage.status, 0, "unparseable payload must not block");
});
