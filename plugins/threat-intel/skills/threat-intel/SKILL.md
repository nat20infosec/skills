---
name: threat-intel
description: Produce a structured threat intelligence analysis from a URL, article, CVE, malware family, campaign name, or APT group reference. Covers campaign architecture, IOC extraction, MITRE ATT&CK mapping, and an organizational relevance assessment. Use this whenever someone asks to analyze, research, or write up a specific threat, attack, vulnerability, or campaign — not for vendor/product due diligence (that's `osint-recon`).
triggers:
  - "analyze this threat"
  - "break down this attack"
  - "write up this campaign"
  - "pull IOCs from"
  - "map this to MITRE"
  - "what do we know about [malware/campaign/APT]"
  - "threat brief on"
  - "is this relevant to us"
  - "analyze this article"
  - "CVE analysis"
inputs:
  - name: source
    description: A URL to a threat-intel article, a pasted article body, a CVE ID, a malware family name, a campaign name, or an APT group identifier. Anything that anchors the analysis.
    required: true
  - name: focus
    description: What the requester cares about most — e.g., "IOCs for blocking", "detection gaps", "relevance to our Azure AD environment", "just the executive summary". Shapes depth and emphasis.
    required: false
  - name: context
    description: Why the analysis is happening — e.g., SOC escalation, proactive hunt, executive briefing, detection-engineering input. Affects tone and detail level.
    required: false
outputs:
  - A Threat Intelligence Analysis report — executive summary, technical deep-dive, MITRE ATT&CK mapping, defanged IOC tables, and an organizational relevance assessment with concrete actions.
tools:
  - read_files
  - write_files
  - web_search
  - web_fetch
---

# Threat Intelligence Analysis

Produce a structured, actionable threat intelligence report from a source — a URL, pasted article, CVE, malware family, campaign name, or APT group. The point is to turn raw threat reporting into assessed intelligence: what the threat does, how it works, whether it matters to your organization, and what to do about it.

This skill produces *analysis*, not a raw dump. Every report ends with a relevance assessment that connects the threat to your environment and gives the reader concrete actions.

## When to use this skill

- **A threat article lands** — someone drops a URL or pastes text from a vendor blog, news site, or advisory and wants it analyzed.
- **A CVE needs assessment** — not just "is it patched" but "what's the attack chain, is it being exploited, does it hit our stack."
- **Campaign / malware / APT research** — a name comes up (in a briefing, an alert, a Slack thread) and someone needs the full picture.
- **IOC extraction for blocking** — pull structured, defanged IOCs from reporting and get them into a format the SOC can ingest.
- **Detection engineering input** — map a threat to ATT&CK techniques so detection rules can be built or validated.
- **Executive briefing prep** — distill a complex campaign into a summary a CISO can read in 30 seconds, with the technical depth behind it.

## When not to use this skill

- **Vendor / product / domain due diligence.** "Tell me about this vendor before we buy their product" is `osint-recon`. That skill evaluates a solution's security posture; this one analyzes threats.
- **Writing or running a security review workflow.** If your org has its own review processes (architecture reviews, exception reviews, risk sign-offs), those have their own skills. This skill can *inform* them — if a threat-intel finding is relevant to a review in progress, hand the finding over.
- **Compliance or policy authoring.** Different workflows.
- **Incident response actions.** This skill produces intelligence. Containment, eradication, and recovery are operational — this informs them but doesn't execute them.

## Scope and guardrails

- **Analysis of public reporting.** This skill synthesizes published threat intelligence — vendor research, advisories, news coverage, public IOC feeds, and open enrichment sources. It does not generate original telemetry or touch target infrastructure.
- **No active scanning or probing.** IOC enrichment uses public lookup services (VirusTotal references, AbuseIPDB, Shodan search results, PeeringDB). It does not connect to C2 infrastructure, download malware samples, or interact with threat-actor resources.
- **IOCs are always defanged.** IPs use `[.]` notation, domains use `[.]`, URLs use `hxxp[s]://`. Hashes are presented as-is. No live IOC is ever rendered clickable.
- **Attribution follows the source.** If the primary research says "high confidence Russian-speaking group," report that with attribution. Don't escalate or soften the source's assessment. For analytical judgments this skill adds, use explicit confidence language.
- **Copyright awareness.** Synthesize and analyze; don't reproduce large blocks from source articles. Attribute claims to their source.

## Research phase

Report quality is a direct function of research depth. Don't start writing until you've exhausted the accessible source material.

### 1. Fetch the primary source

If the user provides a URL, fetch it immediately. Extract all factual claims, IOCs, TTPs, infrastructure details, attribution data, and source references.

### 2. Find and fetch the upstream research

News aggregators (GBHackers, BleepingComputer, The Hacker News, CyberPress, SecurityWeek, Dark Reading, CyberSecurityNews) usually rewrite vendor research. Find the **primary source** — the vendor blog, research paper, or advisory the article is based on — and fetch it. The primary source almost always has deeper technical detail, additional IOCs, and context the news article dropped.

Common primary sources: VMRay, Mandiant/Google TAG, CrowdStrike, Palo Alto Unit 42, Cisco Talos, Microsoft MSTIC/DART, ESET, Kaspersky GReAT, SentinelOne/SentinelLabs, Sophos X-Ops, Recorded Future, Volexity, Trend Micro, CheckPoint Research, Proofpoint, Secureworks, ANY.RUN, Huntress.

### 3. Cross-reference and enrich

Run 3–6 additional searches to:
- Find other outlets covering the same campaign — they sometimes surface unique details the primary source omitted.
- Look up specific IOCs (IPs, domains, hashes) on public reference pages — AbuseIPDB, VirusTotal references, Shodan search results.
- Check the hosting provider/ASN for prior abuse history (PeeringDB, prior reporting).
- Find related campaigns or malware families that share infrastructure or TTPs.
- Look up referenced CVEs for patch status and exploit availability (NVD, CISA KEV).

### 4. Check for adjacent context

If the threat involves tools, platforms, or infrastructure patterns that intersect with your organization's environment — e.g., Azure AD attacks, GitHub Actions abuse, supply-chain vectors, specific hosting providers — note the intersection for the relevance assessment.

## Report structure

Every report follows this skeleton. Sections scale in depth based on available intelligence — a thin CVE advisory gets a lighter treatment than a multi-layer campaign — but the structure stays consistent so reports are predictable to read.

````markdown
# {Campaign/Threat Name} — Threat Intelligence Analysis

**Date:** {YYYY-MM-DD}
**Analyst:** {your team} / {analyst name}
**Classification:** TLP:CLEAR
**Source:** {primary source}, {secondary sources}
**Status:** {Active campaign | Patched | Mitigated | Historical}

---

## Executive Summary

{2–4 sentences. What is this threat, who is behind it, what does it do, why should we care. Readable by a CISO in 30 seconds.}

---

## Campaign Architecture / Technical Analysis

{The core of the report. Organize by logical layers or phases of the attack. Use sub-headings. Include tables for structured data — malware families, infrastructure roles, capability comparisons. Be specific: IP addresses, file paths, registry keys, API endpoints, protocol details.}

---

## Infrastructure

{Hosting providers, ASNs, IP ranges, domains, TLS certificate details, C2 communication patterns, enumeration methodology if known. Note infrastructure reuse or overlap with other campaigns.}

---

## Defense Evasion & Persistence

{Specific techniques: exact PowerShell commands, registry paths, service names, file locations. This section feeds detection engineering directly.}

---

## MITRE ATT&CK Mapping

{Map every identifiable technique. Use sub-technique IDs (T1059.001 not just T1059). Include the tactic column. Note inferred vs. directly observed techniques.}

| Tactic | ID | Technique |
|---|---|---|
| ... | ... | ... |

---

## Indicators of Compromise

{Organized by type in tables. All IPs and domains defanged with [.] notation.}

### File IOCs

| Type | Value |
|---|---|
| ... | ... |

### Network IOCs

| Type | Value | Role |
|---|---|---|
| ... | ... | ... |

### C2 Communication Paths

| Path | Host | Purpose |
|---|---|---|
| ... | ... | ... |

### Behavioral IOCs (Endpoint)

- {Observable endpoint behaviors — process chains, registry modifications, service creation patterns, distinctive network signatures}

---

## Organizational Relevance Assessment

{The section that makes this actionable. For each relevance point:}

### {N}. {Specific Risk Title}

{State the specific risk to your environment. Reference the technology or control that's affected. Connect it to what the report found.}

**Action:** {Concrete, assignable action. What to check, what to block, what to validate, who to flag.}

---

## Sources

| Source | URL |
|---|---|
| ... | ... |
````

## Confidence and attribution conventions

For analytical judgments this skill adds (not facts directly stated by a source):

- **High confidence** — multiple independent sources corroborate, or a primary vendor research report states it directly with evidence.
- **Moderate confidence** — single credible source, or a strong inference from observed evidence.
- **Low confidence / Assessed** — inference from circumstantial evidence or pattern-matching against known campaigns.

Attribute the source's own confidence claims to them: "VMRay attributes with high confidence..." Don't launder a source's assessment as your own.

## Writing guidelines

- **Direct and technical.** This is an internal security report for a senior security engineering audience. No hedging, no filler, no blog-post tone.
- **Facts from sources, judgments labeled.** Technical facts from primary research are stated directly. Analytical judgments (attribution, intent, future targeting) carry explicit confidence language.
- **IOCs always defanged.** IPs: `212.193.30[.]29`. Domains: `github[.]com`. URLs: `hxxps://`. Hashes as-is. No exceptions.
- **Tables for structured data.** Malware inventories, IOC lists, MITRE mappings, infrastructure roles, source lists — all tables.
- **MITRE mapping is thorough.** Map every identifiable technique with sub-technique IDs. A partial mapping is still valuable — flag what couldn't be mapped and why.
- **Relevance assessment is mandatory.** A threat report without "so what does this mean for us" is academic. Every relevance point gets a concrete action.

## Things to avoid

1. **Reproducing source material.** Synthesize and cite; don't copy-paste blocks from articles.
2. **Speculative attribution beyond the source.** If the primary research says "Russian-speaking group," report that. Don't escalate to a specific named APT without evidence.
3. **Skipping the relevance assessment.** That's the point of the report for your security team.
4. **Burying IOCs in prose.** They belong in the IOC tables, structured and defanged.
5. **Shallow MITRE mapping.** "Initial Access" and "Execution" alone aren't useful. Map the full kill chain.
6. **Ignoring the primary source.** If the user gives a news article, find the vendor research it's based on. The news version is always thinner.

## Enrichment search patterns

These tend to yield good results when cross-referencing:

- `"[campaign name]" IOC list` — IOC-focused writeups
- `"[campaign name]" MITRE ATT&CK` — existing TTP mappings
- `[IP address] [ASN name]` — infrastructure context
- `"[malware family]" analysis execution` — sandbox/dynamic analysis reports
- `"[CVE ID]" exploit proof of concept` — exploit availability
- `[hosting provider] malicious infrastructure` — prior abuse patterns

## Configuring this skill for your environment

The relevance assessment is only as good as the context it's checked against. Before using this skill for real, fill in your own environment's facts — cloud provider(s), identity provider, EDR/EPP, network/proxy stack, SIEM, source control, relevant compliance scope, and any internal ticketing/KB system findings should be routed to. Keep this as a short reference block (either in your own fork of this SKILL.md, or in a separate notes file this skill reads) rather than hard-coding it here, so the skill stays shareable.

## Related skills

- `osint-recon` — vendor/product/domain due diligence. If a threat-intel finding names a vendor your organization uses or is evaluating, `osint-recon` can go deep on that vendor's posture. Different question: "is this vendor secure" vs "is this threat relevant."
