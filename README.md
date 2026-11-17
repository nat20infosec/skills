# nat20infosec Claude Code skills

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces) of defensive-security skills: malware triage, OSINT recon, and threat-intel analysis.

## Install

```
/plugin marketplace add nat20infosec/skills
/plugin install malware-triage@nat20infosec
/plugin install osint-recon@nat20infosec
/plugin install threat-intel@nat20infosec
```

## Plugins

| Plugin | What it does |
|---|---|
| [`malware-triage`](plugins/malware-triage) | Static-only first-look triage of a suspicious file (hashing, strings, header inspection) into a Scope/Capability/Attribution/Detection brief. Never executes the file. The dynamic-analysis lab scaffold ("the cage") that pairs with it is still only in the archived [malware-triage](https://github.com/nat20infosec/malware-triage) repo — it hasn't been migrated here yet. |
| [`osint-recon`](plugins/osint-recon) | Passive, public-source recon on a vendor, product, domain, or your own org's footprint, graded by source reliability and corroboration. |
| [`threat-intel`](plugins/threat-intel/README.md) | Turns a threat article, CVE, malware family, campaign, or APT reference into a structured analysis: architecture, IOCs, MITRE ATT&CK mapping, relevance assessment. **Before real use**, fill in the "Configuring this skill for your environment" section with your own org's stack — this version ships generic on purpose. |

## One repo, not several

All nat20infosec skills live here now. `malware-triage` and `osint-recon` used to be their own repos; both are archived and point back here. New skills get added as a new `plugins/<name>/` folder in this repo instead of a new repo, the same pattern [Trail of Bits uses for theirs](https://github.com/trailofbits/skills).

## Contributing

Each plugin is a self-contained folder under `plugins/<name>/` with its own `.claude-plugin/plugin.json` and `skills/<name>/SKILL.md`. To add a new one, copy that shape and add an entry to `.claude-plugin/marketplace.json`.

A GitHub Actions check ([`.github/workflows/validate-plugins.yml`](.github/workflows/validate-plugins.yml)) runs on every push and PR and fails the build if: `marketplace.json` or any `plugin.json` isn't valid JSON or is missing a required field, a plugin's `source` path doesn't exist, a plugin's name/version drifts from its marketplace entry, or a plugin is missing its `skills/<name>/SKILL.md`. Run it locally with:

```bash
node scripts/validate-plugins.mjs
```
