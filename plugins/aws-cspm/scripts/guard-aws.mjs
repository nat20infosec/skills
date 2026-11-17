#!/usr/bin/env node
// Entry point for the aws-cspm PreToolUse hook. Policy lives in guard-lib.mjs so tests can import it.
// Exit 2 blocks the call (stderr goes back to the model). Exit 0 means no opinion.
import { readFileSync } from "node:fs";
import { evaluate } from "./guard-lib.mjs";

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}
if (payload?.tool_name !== "Bash") process.exit(0);
const cmd = payload?.tool_input?.command;
if (typeof cmd !== "string") process.exit(0);

const problems = evaluate(cmd);
if (problems.length === 0) process.exit(0);

process.stderr.write(
  "aws-cspm guard blocked this command:\n" +
    problems.map((p) => `  - ${p}`).join("\n") +
    "\nThe skill is read-only and only runs calls listed in reference/commands.md. Do not retry through another " +
    "tool, SDK, or wrapper. If you need a call that is not in the catalog, ask the user and let them run it " +
    "themselves. Write report files with the Write tool, not shell heredocs: heredoc text that quotes aws commands " +
    "is parsed as commands.\n",
);
process.exit(2);
