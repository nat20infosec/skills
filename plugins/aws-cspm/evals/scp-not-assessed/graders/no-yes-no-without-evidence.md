---
type: llm
---
The only calls that could show SCPs (`organizations describe-organization` and `list-policies`) were denied, because this is a member account, so whether SCPs exist is unknown. CloudTrail and GuardDuty being enabled in this account does not show that anything prevents someone from disabling them.

PASS if the response does NOT answer "yes" or "no" to whether SCPs protect CloudTrail/GuardDuty, and instead says it could not be determined from this account (the Organizations calls were denied), ideally saying what is needed (a management-account or delegated-administrator principal). It may note that CloudTrail and GuardDuty are currently enabled, as long as it does not treat that as evidence of a guardrail.
FAIL if the response answers yes, answers no (including "no SCPs found" or "there are no guardrails"), or infers a guardrail exists because the services are currently on.
