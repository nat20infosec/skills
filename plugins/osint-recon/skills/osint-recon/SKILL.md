---
name: osint-recon
description: Passive, public-source security recon on a vendor, product, domain, or your org's own footprint. Produces a graded OSINT brief. Security/technical scope only, not financial or legal due diligence.
argument-hint: "<vendor, product, or domain> [what you want to know]"
---

# OSINT Recon

A passive, public-source investigation into a vendor, product, domain, or piece of infrastructure — turned into a single deliverable: an **OSINT Intelligence Brief**. The brief leads with an assessment, backs every claim with a graded, sourced finding, and ends with an honest account of what it couldn't answer.

This skill produces intelligence, not a decision. It's built to feed whatever review or approval process a security or platform team already runs — not to replace it.

**Scope note:** this is a *security and technical-footprint* tool. It does not assess financial health, legal or sanctions exposure, or general reputational risk — those belong to a broader vendor-due-diligence process (often owned by legal, procurement, or GRC). If someone needs that wider picture, this skill covers one input to it, not the whole thing.

## When to use this skill

- **Ahead of a vendor or technology review** — build the external security picture before the review starts, so the conversation begins informed instead of starting from zero.
- **Technology due diligence** — a team wants to adopt a tool and needs the public security signal before committing real review time to it.
- **Domain or infrastructure recon** — DNS posture, certificate-transparency footprint, email-authentication strength, historical presence for a given domain.
- **Threat-context research** — is this technology or vendor category currently being targeted? Is it in CISA KEV? What does the relevant ATT&CK pattern look like?
- **Your own organization's exposure** — leaked credentials, forgotten subdomains, brand/typosquat abuse, accidentally public secrets. Defensive recon of your own footprint, run the same way you'd run it on anyone else's.

## When not to use this skill

- **Full vendor due diligence.** Financial stability, legal history, sanctions/PEP screening, and general reputational risk are out of scope. This skill is one input to that process, not a substitute for it.
- **Investigating a person.** Not a people-search tool. Threat-context work means adversary tactics and infrastructure, not a dossier on a named individual. If asked to profile someone specific, decline and ask what security question is actually being answered.
- **Writing the review's verdict.** This produces findings. Whatever process turns findings into a decision — an architecture review, a risk sign-off, a go/no-go — is a separate step this skill feeds, not one it performs.
- **Active testing.** No scanning, probing, authentication attempts, or exploitation. This observes what's already public; it doesn't touch the target. Active testing is a different, separately authorized activity.

## Scope and guardrails

These aren't suggestions — they're what makes doing this on a company you don't own defensible in the first place.

- **Passive and public-source only.** Search engines, public DNS/WHOIS, certificate transparency, web archives, published trust/security pages, public corporate and regulatory filings, public threat-intel reporting, public breach indices. Nothing that reaches into the target's systems.
- **No boundary-crossing.** No port scanning, no active probing, no login or credential-validation attempts, no CAPTCHA or authwall bypass, no pulling gated content. The fact that something is theoretically reachable doesn't make reaching it in scope.
- **People are out of scope.** Adversary tactics and infrastructure are fair game; a named individual's personal footprint is not.
- **Minimize what you collect.** Pull only what actually informs the security assessment. If personal data surfaces incidentally — a leaked-credential count tied to a domain, say — report the aggregate, not the detail. Don't keep more than the finding needs.
- **This produces intelligence, not permission.** A finding that a vendor looks weak doesn't authorize anyone to act on it beyond raising it in the review it feeds.

If a question genuinely requires active techniques to answer, say so plainly, mark it out of scope, and name it as a separate activity that would need its own authorization. Don't quietly stretch the passive boundary to get an answer.

## Investigation areas

Most recons touch more than one of these. Pull only what the requester's actual question needs — don't run the full sweep by default.

### Vendor and organizational posture
What the company is, and how seriously security appears to factor into how it's run.
- Trust/security page, `security.txt`, published certifications (SOC 2, ISO 27001, HITRUST, PCI), sub-processor list, incident/status history.
- Breach and incident history from public reporting, ransomware leak-site mentions, breach-index domain presence.
- Corporate identity — ownership, funding, jurisdiction, headquarters (relevant to data-residency questions) via public corporate/regulatory records.
- Engineering signal — a public GitHub org (accidental exposure, dependency hygiene), job postings that reveal the stack.

### Domain and infrastructure footprint
What's actually running, as seen from the outside.
- WHOIS/RDAP, name servers, hosting provider and ASN, registrar.
- Email-authentication posture — SPF, DKIM, and DMARC policy strength (`p=none` vs. `p=reject` is the load-bearing detail here).
- Certificate-transparency logs, to surface subdomains and naming/environment patterns.
- Web-archive history — what used to be there, what changed, what got quietly deprecated.
- Technology fingerprint visible from published pages — framework, CDN, analytics, embedded third parties.

### Product and architecture risk
Risk that comes from *how the thing is built*, independent of any specific incident or the vendor's general posture. This is easy to miss because it doesn't fit neatly under "the vendor is careless" or "an attacker is targeting them" — it's a structural property of the product.
- Does the product's data model have a default-permissive posture (e.g., no native row-level access control, broad tokens that grant more than a typical integration needs)?
- Are there well-documented, category-wide misconfiguration patterns for this kind of product that show up across many customers' deployments, not just this vendor's own infrastructure?
- Does the product's integration surface (API keys, webhooks, embeds) create exposure that depends on how *your* team configures it, not on anything the vendor controls?

### Threat context
Whether this technology or vendor is something adversaries are actually paying attention to right now.
- Known vulnerabilities — NVD/CVE history, and CISA KEV (known-exploited) membership specifically.
- Active targeting — public threat-intel reporting naming the vendor or its category; ransomware or APT campaigns naming the product.
- The relevant MITRE ATT&CK techniques for how this class of technology tends to get abused.
- Leak-site or paste-site mentions of the vendor.

### Your own organization's exposure
The same recon, pointed at yourself, run with the same rigor.
- Certificate transparency and public DNS for your own domains and any sibling brands — forgotten subdomains, environment names leaking in DNS.
- Leaked-credential presence for your domains, reported as an aggregate, not a personal detail.
- Public repos or leaked keys referencing your own infrastructure.
- Typosquat and brand-abuse domains that could be weaponized against you.

## Steps

This follows the shape of the classic intelligence cycle, with one addition at the end that's easy to skip and shouldn't be: closing the loop.

### 1. Scope the requirement
Pin down the subject, which investigation areas actually apply, why the recon is happening, and any specific question the requester wants answered. State the scope back in one line before doing real work, so it can be corrected cheaply. Check the ask against the guardrails above right now — if answering it honestly would require active techniques or profiling a person, say so and stop before spending effort.

### 2. Seed collection
Establish the anchors. For a vendor: primary domain and corporate identity. For a domain: WHOIS/DNS baseline. For a technology: its canonical name and the vendor behind it. A broad search-engine pass plus the vendor's own site orients everything downstream.

### 3. Expand per area
Work each in-scope area from the list above. Favor primary sources — the vendor's own trust page, the actual DNS record, the CT log entry, the NVD page — over someone else's summary of them. If a keyed or MCP-backed source (Shodan/Censys read views, VirusTotal, a DNS/CT tool) is available, use it; if it isn't, fall back to plain web search and say plainly what you couldn't reach. No keyed tool is required for this skill to function — passive web access is the floor.

### 4. Cross-reference and grade
Corroborate before trusting. Grade every finding on two independent axes, not one — conflating them is the single most common way OSINT briefs overstate their own confidence:

- **Source reliability** — how much this *kind* of source deserves trust in general. **Primary** (the vendor's own authoritative page, a DNS record you queried yourself), **Established** (a source with a track record: NVD, CISA, a recognized research outfit), **Unverified** (a single blog post, an anonymous forum post, a source you've never used before).
- **Corroboration** — how well *this specific claim* holds up. **Confirmed** (two or more independent sources agree), **Single-source** (one credible source, uncorroborated), **Inferred** (reasoned from other facts, not directly stated anywhere).

A finding graded `[Primary · Confirmed]` and one graded `[Unverified · Single-source]` should never read the same way in the brief, even if both happen to be true. Tag exposure/risk findings with a separate **Severity** (Critical/High/Medium/Low/Info) on top of this.

### 5. Assess
Step back from the individual findings to the "so what." What does this say about the vendor's posture, the infrastructure's hygiene, the technology's threat exposure, the product's architectural risk, or your own footprint? This becomes the brief's lead — two to four bullets, and honest about how confident each one actually is.

### 6. Report
Write the brief in the format below. Save it wherever the requester asked; otherwise return it inline. If it's feeding a downstream review, say so at the top, so the reader knows where this is meant to land.

### 7. Close the loop
Once the brief has actually been used, note briefly what it did or didn't answer well enough. Did the review need something this recon didn't cover? Did a finding turn out to matter more or less than its grade suggested? This doesn't need its own document — a line or two appended to the brief, or a note in whatever tracks the review, is enough. Skipping this is exactly how a recon process stays static instead of improving.

## Output format

````markdown
# OSINT Brief — {subject}

**Subject:** {one line}
**Investigation areas:** {vendor-posture | domain-infra | product-architecture | threat-context | own-exposure — one or more}
**Context:** {what review or decision this feeds, if any}
**Posture:** Passive, public-source only
**Handling:** {who this brief is meant for; note if the fact of this recon should stay confidential}
**Date:** {date} · **Analyst:** {name}

## Assessment (BLUF)
- {2–4 bullets: what the intelligence means, with honest confidence.}

## Key findings
- [{Source reliability} · {Corroboration}{ · Severity: X}] {finding}. — {source}
- ...

## Details
### Vendor & organizational posture   {include only in-scope areas}
### Domain & infrastructure footprint
### Product & architecture risk
### Threat context
### Your own organization's exposure

## Recommendations
- {Tied to a specific finding: what to verify, what to ask the vendor, what to remediate.}

## Gaps & limitations
- {What passive sources couldn't answer, and what would need vendor confirmation or a separately authorized active test.}

## Sources
1. {url} — {what it supported}
````

## Example

**Input:** a SaaS workflow-automation vendor being evaluated for a new integration; the requester specifically wants to know about certifications, breach history, and email-authentication posture.

````markdown
# OSINT Brief — Brightleaf Ops

**Subject:** Brightleaf Ops — SaaS workflow-automation vendor, evaluated for a data-pipeline integration.
**Investigation areas:** vendor-posture, domain-infra, threat-context
**Context:** feeds an upcoming architecture review
**Posture:** Passive, public-source only
**Handling:** internal to the review team
**Date:** 2026-07-10 · **Analyst:** J. Alvarez

## Assessment (BLUF)
- Solid, current security program: SOC 2 Type II and ISO 27001 published, no evidence of a vendor-side breach. (Primary · Confirmed.)
- Email-authentication is a real gap: DMARC exists but is set to `p=none`, so nothing stops spoofed mail claiming to be from their domain. (Primary · Confirmed, Severity: Medium.)
- The product has no native per-record access control — a valid API token grants full-base access. That's a property of how customers configure it, not a flaw in Brightleaf's own infrastructure, but it's real exposure if our integration doesn't scope tokens carefully. (Established · Inferred.)

## Key findings
- [Primary · Confirmed] SOC 2 Type II held since 2022, renewed annually; ISO 27001:2022 certified. — vendor trust page
- [Primary · Confirmed · Severity: Medium] DMARC record present, policy `p=none` — monitoring only, not enforced. — DNS query
- [Established · Single-source] No public reporting of a vendor-side breach; credential-leak indices show Brightleaf-domain logins in infostealer dumps, which reflects compromised end-user devices, not compromised vendor infrastructure — worth stating explicitly so it isn't misread as a breach finding. — breach-index search
- [Established · Inferred] No native row-level access control; full-base access from a single token. Real exposure depends on how the integrating team scopes and rotates tokens, not on Brightleaf's own posture. — third-party app-security research on the product category

## Details
### Vendor & organizational posture
Current SOC 2 Type II and ISO 27001, both independently verifiable via the vendor's trust page. No public incident history found.

### Domain & infrastructure footprint
DMARC published but unenforced (`p=none`). SPF and DKIM both present and correctly configured.

### Product & architecture risk
No native per-record authorization layer — a single API token grants full access to whatever base it's scoped to. This is a known pattern for this category of no-code/low-code platform, not something specific to Brightleaf.

### Threat context
No CVEs (SaaS, vendor-managed). No ransomware or APT reporting naming the vendor. Category risk is generic third-party data exposure via over-scoped tokens, matching the ATT&CK "valid accounts" pattern for SaaS integrations.

## Recommendations
- Ask Brightleaf about their DMARC enforcement timeline — low stakes for this specific integration, but worth a note given how easy it'd be to fix.
- Scope any integration token to the minimum bases/tables the pipeline actually needs, and set a rotation cadence — this is the finding that actually matters for our side of the integration.
- No breach or targeting signal — no elevated diligence needed beyond standard review coverage.

## Gaps & limitations
- SOC 2 report contents unverified — only the certification badge is public; the report itself would need an NDA request.
- Runtime configuration (headers, TLS setup) not assessed — that's active testing, out of scope here.

## Sources
1. Brightleaf trust page — certifications
2. DNS query — DMARC record
3. Breach-index search — credential-leak context
````

## Writing voice

- **Assessment first.** Lead with what it means, then the evidence behind it. Nobody wants to read a search log before finding out whether they should be worried.
- **Every fact traceable, on both axes.** Source reliability and corroboration on every finding, always. An unsourced claim is an inference — say so, don't dress it up as observation.
- **Say what you couldn't answer.** The gaps section isn't an apology — it's the honest edge of what passive sources can tell you, and naming it plainly is more useful than pretending the picture is complete.
- **Specific beats generic, every time.** "DMARC `p=none`, monitoring only" beats "email security could improve." "In CISA KEV since March 2026" beats "has known vulnerabilities."
- **Every recommendation traces to a finding.** If a recommendation doesn't point back to something actually found, it doesn't belong in this brief.

## Things to avoid

1. **Crossing from passive to active.** The moment a step would touch the target's own systems, it's a different, separately authorized activity — name it and stop.
2. **Profiling a person.** Adversary tactics and vendor posture are in scope. A named individual is not, regardless of how the request is phrased.
3. **Collapsing the two grading axes into one.** A well-corroborated claim from an unverified source and a single-source claim from a primary source are not the same finding, even when they land on the same conclusion.
4. **Dumping the search log instead of assessing it.** The brief is the intelligence, not a transcript of every query that produced it.
5. **Treating keyed tools as load-bearing.** Passive web access is the floor. Say what a keyed source would have added, rather than blocking on its absence.
6. **Hoarding incidental personal data.** Report the security-relevant aggregate; don't keep the personal detail around just because it surfaced.
7. **Overstating confidence because a claim is convenient.** A single dated blog post is `Unverified · Single-source`, never a settled fact.

## References

- Public sources this skill commonly draws on — search engines, WHOIS/RDAP, certificate-transparency logs, web archives, NVD, CISA KEV, MITRE ATT&CK, breach indices, public corporate/regulatory filings — are all public web references; cite the specific one used for each finding rather than the category.
- The confidence-grading approach here (source reliability graded independently from corroboration) is a lightweight adaptation of two-axis grading conventions used in professional intelligence and threat-intel work — simplified for a single-analyst, business-context brief rather than a formal intelligence product.
