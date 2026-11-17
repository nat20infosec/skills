# nat20infosec Claude Code skills

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces) of defensive-security skills: malware triage, OSINT recon, threat-intel analysis, and AWS posture review.

## Install

```
/plugin marketplace add nat20infosec/skills
/plugin install malware-triage@nat20infosec
/plugin install osint-recon@nat20infosec
/plugin install threat-intel@nat20infosec
/plugin install aws-cspm@nat20infosec
/plugin install owasp-security@nat20infosec   # third-party, by Agam More
```

## Plugins

| Plugin | What it does |
|---|---|
| [`malware-triage`](plugins/malware-triage/README.md) | Static-only first-look triage of a suspicious file (hashing, strings, header inspection) into a Scope/Capability/Attribution/Detection brief. Never executes the file. Ships with a Vagrant lab scaffold ("the cage") for the isolated VM used in the dynamic-analysis follow-up. |
| [`osint-recon`](plugins/osint-recon) | Passive, public-source recon on a vendor, product, domain, or your own org's footprint, graded by source reliability and corroboration. |
| [`threat-intel`](plugins/threat-intel/README.md) | Turns a threat article, CVE, malware family, campaign, or APT reference into a structured analysis: architecture, IOCs, MITRE ATT&CK mapping, relevance assessment. **Before real use**, fill in the "Configuring this skill for your environment" section with your own org's stack — this version ships generic on purpose. |
| [`aws-cspm`](plugins/aws-cspm/README.md) | Read-only AWS posture review. Sweeps an account or triages Prowler / Security Hub output, rates each finding by actual exposure path and blast radius, and reports what it could not see. Includes a generated index of all Security Hub CSPM controls so control IDs are verified before they're cited. **v0.2.0: not yet run against a live account.** |
| [`owasp-security`](https://github.com/agamm/claude-code-owasp) | **Third-party, by [Agam More](https://github.com/agamm) (MIT).** OWASP Top 10:2025, ASVS 5.0, LLM Top 10 and Agentic Top 10 security review. Listed here by reference — nothing is copied into this repo — and pinned to a reviewed upstream commit. |

### Third-party plugins

Entries whose `source` points at another repo are not our work and are not vendored. They're pinned to a full commit SHA (CI enforces this), so an upstream change never reaches you until it's been reviewed here and the pin is bumped.

## One repo, not several

All nat20infosec skills live here now. `malware-triage` and `osint-recon` used to be their own repos; both are archived and point back here. New skills get added as a new `plugins/<name>/` folder in this repo instead of a new repo, the same pattern [Trail of Bits uses for theirs](https://github.com/trailofbits/skills).

## Contributing

Each plugin is a self-contained folder under `plugins/<name>/` with its own `.claude-plugin/plugin.json` and `skills/<name>/SKILL.md`. To add a new one, copy that shape and add an entry to `.claude-plugin/marketplace.json`.

A GitHub Actions check ([`.github/workflows/validate-plugins.yml`](.github/workflows/validate-plugins.yml)) runs on every push and PR and fails the build if: `marketplace.json` or any `plugin.json` isn't valid JSON or is missing a required field, a plugin's `source` path doesn't exist, a plugin's name/version drifts from its marketplace entry, or a plugin is missing its `skills/<name>/SKILL.md`. Run it locally with:

```bash
node scripts/validate-plugins.mjs
```
