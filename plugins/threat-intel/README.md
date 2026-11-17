# threat-intel

A [Claude Code](https://claude.com/claude-code) skill that turns a threat article, CVE, malware family, campaign name, or APT group reference into a structured **Threat Intelligence Analysis**: campaign architecture, infrastructure, defense evasion/persistence, a MITRE ATT&CK mapping, defanged IOC tables, and an organizational relevance assessment with concrete actions.

> Only available via the [nat20infosec Claude Code marketplace](https://github.com/nat20infosec/skills) for now — there's no standalone repo for this one (yet). `/plugin marketplace add nat20infosec/skills` then `/plugin install threat-intel@nat20infosec`.

Not for vendor/product due diligence — that's [`osint-recon`](../osint-recon). This skill analyzes threats, not vendors.

## What it does

- Fetches the primary source behind a threat article (news outlets usually rewrite vendor research — this skill finds and reads the vendor blog/advisory underneath), then cross-references 3-6 additional searches for IOCs, infrastructure context, and related campaigns.
- Produces a single Markdown report: executive summary, technical deep-dive, MITRE ATT&CK mapping (with sub-technique IDs), defanged IOC tables (file/network/C2/behavioral), and an organizational relevance assessment that ties the threat back to your own environment with assignable actions.
- Attributes confidence explicitly — a source's own attribution claim is reported as theirs, not escalated or laundered into this skill's own assessment.
- IOCs are always defanged (`[.]` notation, `hxxp[s]://`) — nothing renders as a clickable live indicator.

## Install

```
/plugin marketplace add nat20infosec/skills
/plugin install threat-intel@nat20infosec
```

## Use

```
/threat-intel https://example-vendor.com/blog/some-campaign-writeup
```

or just paste a URL, CVE ID, malware family, campaign, or APT name and ask for an analysis — Claude Code will pick this skill up when the request fits.

## Before real use

This version ships generic on purpose. See the **"Configuring this skill for your environment"** section in [SKILL.md](skills/threat-intel/SKILL.md) and fill in your own org's cloud/identity/EDR/network/SIEM stack and where findings should route — the relevance assessment is only as good as the context it's checked against.

## License

[MIT](../../LICENSE)
