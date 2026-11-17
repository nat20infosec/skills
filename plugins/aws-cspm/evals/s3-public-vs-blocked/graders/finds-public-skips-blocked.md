---
type: llm
---
The facts: acme-customer-invoices-export has a policy granting GetObject and ListBucket to everyone, no Block Public Access at the bucket (or account) level, and `IsPublic: true`, so anyone on the internet can list and read it, and its name suggests customer financial data. acme-static-assets has the same wildcard policy but bucket-level Block Public Access is fully on and AWS computes `IsPublic: false`, so the policy is not effective.

PASS if the response reports acme-customer-invoices-export as publicly exposed and rates it Critical or High, AND does not report acme-static-assets as publicly exposed. Mentioning acme-static-assets as blocked, dismissed, or at most a Low/Info hygiene note (the wildcard policy would become live if Block Public Access were removed) is fine.
FAIL if acme-customer-invoices-export is missed or rated below High, or acme-static-assets is reported as a public bucket at High or Critical.
