#!/usr/bin/env node
// Validates .claude-plugin/marketplace.json and every plugin.json it points to.
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^\d+\.\d+\.\d+$/;

const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(path, label) {
  if (!existsSync(path)) {
    fail(`${label}: file not found at ${path}`);
    return null;
  }
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    fail(`${label}: could not read ${path} (${e.message})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`${label}: invalid JSON in ${path} (${e.message})`);
    return null;
  }
}

function requireFields(obj, fields, label, path) {
  if (!obj) return;
  for (const field of fields) {
    const parts = field.split(".");
    let value = obj;
    for (const part of parts) value = value?.[part];
    if (value === undefined || value === null || value === "") {
      fail(`${label}: missing required field "${field}" in ${path}`);
    }
  }
}

const marketplacePath = join(repoRoot, ".claude-plugin", "marketplace.json");
const marketplace = readJson(marketplacePath, "marketplace.json");

requireFields(
  marketplace,
  ["name", "owner.name", "metadata.version", "metadata.description", "plugins"],
  "marketplace.json",
  marketplacePath,
);

if (marketplace && !Array.isArray(marketplace.plugins)) {
  fail(`marketplace.json: "plugins" must be an array in ${marketplacePath}`);
} else if (marketplace) {
  const seenNames = new Set();

  for (const entry of marketplace.plugins) {
    const entryLabel = `marketplace.json entry "${entry?.name ?? "<unnamed>"}"`;

    requireFields(
      entry,
      ["name", "description", "version", "author.name", "source"],
      entryLabel,
      marketplacePath,
    );

    if (!entry?.name) continue;

    if (seenNames.has(entry.name)) {
      fail(`${entryLabel}: duplicate plugin name "${entry.name}" in marketplace.json`);
    }
    seenNames.add(entry.name);

    if (entry.version && !SEMVER.test(entry.version)) {
      fail(`${entryLabel}: version "${entry.version}" is not semver (x.y.z)`);
    }

    if (!entry.source || !entry.source.startsWith("./")) {
      fail(`${entryLabel}: "source" should be a relative path like "./plugins/${entry.name}" (got "${entry.source}")`);
      continue;
    }

    const pluginDir = join(repoRoot, entry.source);
    if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
      fail(`${entryLabel}: source directory "${entry.source}" does not exist`);
      continue;
    }

    const dirBasename = basename(pluginDir);
    if (dirBasename !== entry.name) {
      fail(`${entryLabel}: plugin directory "${dirBasename}" does not match marketplace name "${entry.name}"`);
    }

    const pluginJsonPath = join(pluginDir, ".claude-plugin", "plugin.json");
    const pluginLabel = `plugins/${entry.name}/.claude-plugin/plugin.json`;
    const pluginJson = readJson(pluginJsonPath, pluginLabel);

    requireFields(
      pluginJson,
      ["name", "version", "description", "author.name"],
      pluginLabel,
      pluginJsonPath,
    );

    if (pluginJson) {
      if (pluginJson.name !== entry.name) {
        fail(`${pluginLabel}: name "${pluginJson.name}" does not match marketplace entry name "${entry.name}"`);
      }
      if (pluginJson.version && !SEMVER.test(pluginJson.version)) {
        fail(`${pluginLabel}: version "${pluginJson.version}" is not semver (x.y.z)`);
      }
      if (pluginJson.version && entry.version && pluginJson.version !== entry.version) {
        fail(
          `${pluginLabel}: version "${pluginJson.version}" does not match marketplace entry version "${entry.version}"`,
        );
      }
    }

    const skillDir = join(pluginDir, "skills", entry.name);
    if (!existsSync(skillDir)) {
      fail(`plugins/${entry.name}: expected a skill at skills/${entry.name}/ (not found)`);
    } else if (!existsSync(join(skillDir, "SKILL.md"))) {
      fail(`plugins/${entry.name}: expected skills/${entry.name}/SKILL.md (not found)`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Found ${errors.length} problem(s):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const count = marketplace?.plugins?.length ?? 0;
console.log(`OK: marketplace.json and ${count} plugin.json file(s) validated.`);
