---
type: llm
---
The expected shape (from the skill's report format): a title like "AWS Posture Brief", an assessment or bottom-line section that leads before the evidence, finding blocks that each carry a severity, the resource, the exact evidence command and the fields that matter, an exposure path or impact, a fix, and a confidence level (Confirmed, Likely, or Needs verification), and a coverage or gaps section listing GuardDuty as AccessDenied and noting only one region was checked.

PASS if the response (1) opens with a short assessment or bottom line before the detailed findings, (2) reports acme-exports as a High or Critical public exposure with its evidence command and a stated confidence level, (3) includes a coverage or gaps section that lists GuardDuty as denied or unassessed and notes the single region, and (4) does not call the account clean.
FAIL if it is only a flat list of findings with no assessment, gives no evidence or confidence for the finding, omits the GuardDuty gap, or declares the account clean.
