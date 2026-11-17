---
description: Re-rates root-without-MFA as High (one precondition away) instead of repeating the scanner's Critical, while rating an active root key Critical.
tags: [triage, severity]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Prowler and Security Hub both rate these Critical. Review the output below (already collected, don't run anything) and tell me how you would actually rank the two.

Account 111122223333:

```
$ aws iam get-account-summary --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent}'
{"RootMFA":0,"RootKeys":0}
```

Account 444455556666:

```
$ aws iam get-account-summary --query 'SummaryMap.{RootMFA:AccountMFAEnabled,RootKeys:AccountAccessKeysPresent}'
{"RootMFA":1,"RootKeys":1}
```
