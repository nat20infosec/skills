# Verifies every `aws <service> <operation> --flag` in the aws-cspm command catalog exists in botocore's
# API models, and that the catalog stays read-only: every operation must be describe-/list-/get- (plus one named
# exception) and none may be on the never-run list. Checks names only, not what the output looks like.
# Needs: pip install botocore
import os, re, sys
import botocore.session

DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plugins", "aws-cspm",
                       "skills", "aws-cspm", "reference", "commands.md")
md = open(sys.argv[1] if len(sys.argv) > 1 else DEFAULT, encoding="utf-8").read()
CLI_TO_BOTO = {"configservice": "config", "s3api": "s3", "elbv2": "elbv2", "wafv2": "wafv2"}
# CLI-only conveniences that are not API members
CLI_ONLY = {"query", "output", "region", "profile", "max-items", "page-size", "no-paginate", "starting-token",
            "cli-input-json", "generate-cli-skeleton", "debug", "no-verify-ssl", "endpoint-url"}

# get- calls that return secrets, data, or code, and must never be catalogued (mirrors SKILL.md "never run")
FORBIDDEN = {
    ("secretsmanager", "get-secret-value"), ("ssm", "get-parameter"), ("ssm", "get-parameters"),
    ("ssm", "get-parameters-by-path"), ("ec2", "get-password-data"), ("ec2", "get-console-output"),
    ("ec2", "get-console-screenshot"), ("ecr", "get-login-password"), ("ecr", "get-authorization-token"),
    ("ecr", "get-download-url-for-layer"), ("lambda", "get-function"), ("lambda", "get-function-configuration"),
    ("lambda", "get-layer-version"), ("s3api", "get-object"), ("s3api", "get-object-attributes"),
    ("logs", "get-log-events"), ("logs", "filter-log-events"), ("logs", "get-query-results"),
    ("athena", "get-query-results"), ("glue", "get-connection"), ("glue", "get-connections"),
    ("apigateway", "get-api-keys"), ("apigateway", "get-api-key"), ("apigateway", "get-export"),
    ("cloudformation", "get-template"), ("sts", "get-session-token"), ("sts", "get-federation-token"),
    ("iam", "get-login-profile"), ("sts", "assume-role"),
}
READ_ONLY_VERB = re.compile(r"^(describe|list|get)-")
VERB_EXCEPTIONS = {("iam", "generate-credential-report"), ("configure", "list-profiles")}

sess = botocore.session.get_session()
available = set(sess.get_available_services())

# gather logical command lines from bash fences (join backslash continuations)
cmds = []
for block in re.findall(r"```bash\n(.*?)```", md, re.S):
    block = re.sub(r"\\\n\s*", " ", block)
    for line in block.splitlines():
        line = line.strip()
        line = re.sub(r"\s#.*$", "", line)  # trailing comments
        if "aws " in line:
            for part in re.split(r"\||&&|;", line):
                part = part.strip()
                m = re.search(r"\baws\s+([a-z0-9-]+)\s+([a-z0-9-]+)(.*)", part)
                if m:
                    cmds.append((m.group(1), m.group(2), m.group(3), part))

def pascal(op):
    return "".join(w.capitalize() for w in op.split("-"))

bad, seen = [], set()
for svc, op, rest, full in cmds:
    if (svc, op) in FORBIDDEN:
        bad.append(f"FORBIDDEN OP in catalog: {svc} {op} :: {full[:90]}")
    if not READ_ONLY_VERB.match(op) and (svc, op) not in VERB_EXCEPTIONS:
        bad.append(f"NOT A READ-ONLY VERB: {svc} {op} :: {full[:90]}")
    if svc == "configure":
        continue
    bsvc = CLI_TO_BOTO.get(svc, svc)
    if bsvc not in available:
        bad.append(f"UNKNOWN SERVICE {svc} :: {full[:90]}")
        continue
    model = sess.get_service_model(bsvc)
    ops = {o: model.operation_model(o) for o in model.operation_names}
    want = pascal(op)
    # awscli renames a few ops; accept case-insensitive match
    match = next((o for o in ops if o.lower() == want.lower()), None)
    if not match:
        bad.append(f"UNKNOWN OP {svc} {op} :: {full[:90]}")
        continue
    seen.add((svc, op))
    members = {k.lower() for k in (ops[match].input_shape.members if ops[match].input_shape else {})}
    for flag in re.findall(r"--([a-z0-9-]+)", rest):
        if flag in CLI_ONLY:
            continue
        if pascal(flag).lower() not in members:
            bad.append(f"UNKNOWN FLAG --{flag} on {svc} {op} (members: {sorted(members)[:8]}...)")

print(f"checked {len(cmds)} command lines, {len(seen)} distinct service/operation pairs")
if bad:
    print(f"{len(bad)} PROBLEM(S):")
    for b in bad:
        print("  -", b)
    sys.exit(1)
print("all operations and flags exist in botocore")
