// Parsing and policy for the aws-cspm PreToolUse guard (entry point: guard-aws.mjs). Blocks Bash commands that
// would break the skill's read-only contract:
//   1. any `aws <service> <operation>` that is not in reference/commands.md (the catalog IS the allowlist),
//   2. reads of local AWS credential or SSO/CLI cache files,
//   3. `prowler` runs that do not exclude checks (its secret-scanning checks download Lambda code, read log
//      bodies and read user data, which the skill forbids).
// Exit 2 blocks the call and sends stderr back to the model. Exit 0 means "no opinion".
// Non-aws commands are never touched. If this script itself crashes, Claude Code treats that as a non-blocking
// error, so the IAM role (SecurityAudit + ViewOnlyAccess) stays the real backstop.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const CATALOG = join(here, "..", "skills", "aws-cspm", "reference", "commands.md");

// Global CLI options that consume the next token as their value.
const VALUE_FLAGS = new Set([
  "--profile", "--region", "--output", "--query", "--endpoint-url", "--ca-bundle",
  "--cli-read-timeout", "--cli-connect-timeout", "--color", "--cli-binary-format",
]);

export function loadAllowlist(path = CATALOG) {
  // Windows checkouts (core.autocrlf) store the catalog with CRLF; without this the fence regex matches nothing
  // and every aws call is blocked.
  const md = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const allowed = new Set();
  for (const block of md.matchAll(/```bash\n([\s\S]*?)```/g)) {
    const text = block[1].replace(/\\\n\s*/g, " ");
    for (const m of text.matchAll(/(?:^|[\s;&|()`])aws\s+([a-z0-9-]+)\s+([a-z0-9-]+)/g)) {
      allowed.add(`${m[1]} ${m[2]}`);
    }
  }
  return allowed;
}

// Returns [{svc, op}] for every aws invocation found in the command string, or {svc:null} when unparseable.
export function findAwsCalls(cmd) {
  const calls = [];
  for (const m of cmd.matchAll(/(?:^|[\s;&|()`'"])aws(?:\.exe)?\s+([^;&|()`\n]*)/g)) {
    // `prowler aws ...` and `scout aws ...` name the provider, they are not the AWS CLI.
    if (/\b(?:prowler|scout|cloudfox)\s+$/i.test(cmd.slice(0, m.index + m[0].indexOf("aws")))) continue;
    const tokens = m[1].trim().split(/\s+/).filter(Boolean);
    let i = 0;
    let sawVersion = false;
    while (i < tokens.length && tokens[i].startsWith("--")) {
      if (tokens[i] === "--version") sawVersion = true;
      i += !tokens[i].includes("=") && VALUE_FLAGS.has(tokens[i]) ? 2 : 1;
    }
    const clean = (t) => (t ?? "").replace(/^['"]|['"]$/g, "");
    const svc = clean(tokens[i]);
    const op = clean(tokens[i + 1]);
    if (!svc && sawVersion) continue;
    calls.push({ svc: svc || null, op: op || null, raw: m[0].trim() });
  }
  return calls;
}

export function evaluate(cmd, allowlist = loadAllowlist()) {
  const problems = [];

  if (/\.aws[\\/](?:credentials|config|sso|cli)\b|\bAWS_SECRET_ACCESS_KEY\b|\bAWS_SESSION_TOKEN\b/i.test(cmd)) {
    problems.push("touches local AWS credential, config, or token material, which the skill never reads or prints");
  }

  const prowlerListing = /--(?:list-checks|list-services|list-categories|list-compliance|version)\b|\s-h\b|--help\b/.test(cmd);
  if (/\bprowler\b/i.test(cmd) && !prowlerListing && !/--excluded-checks?\b|--excluded-checks-file\b/.test(cmd)) {
    problems.push(
      "runs prowler without excluding its secret-scanning checks (they fetch Lambda code, log bodies and user data). " +
        "Find them with `prowler aws --list-checks` (names containing 'secrets') and pass them to --excluded-checks",
    );
  }

  for (const { svc, op, raw } of findAwsCalls(cmd)) {
    if (!svc) {
      problems.push(`could not tell which AWS service this call targets: ${raw.slice(0, 80)}`);
    } else if (op === "help" || svc === "help") {
      continue;
    } else if (!op || !allowlist.has(`${svc} ${op}`)) {
      problems.push(`\`aws ${svc} ${op ?? ""}\` is not in reference/commands.md`.replace("  ", " "));
    }
  }

  return problems;
}
