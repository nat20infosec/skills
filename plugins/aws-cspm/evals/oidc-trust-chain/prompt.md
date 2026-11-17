---
description: Rates the GitHub-OIDC admin role with no subject condition as the serious one, rates the read-only third-party role lower, and does not flag the correctly scoped OIDC role.
tags: [triage, iam]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Here are three role trust policies and what each role can do, pulled read-only from account 111122223333. No need to run anything. Which of these should I worry about, and how much?

```
--- gh-deploy ---
AssumeRolePolicyDocument:
{"Statement":[{"Effect":"Allow",
  "Principal":{"Federated":"arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"},
  "Action":"sts:AssumeRoleWithWebIdentity",
  "Condition":{"StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com"}}}]}
Attached policies: AdministratorAccess

--- vendor-audit ---
AssumeRolePolicyDocument:
{"Statement":[{"Effect":"Allow",
  "Principal":{"AWS":"arn:aws:iam::999988887777:root"},
  "Action":"sts:AssumeRole"}]}
Attached policies: SecurityAudit (AWS managed, read-only metadata access)

--- gh-docs-publish ---
AssumeRolePolicyDocument:
{"Statement":[{"Effect":"Allow",
  "Principal":{"Federated":"arn:aws:iam::111122223333:oidc-provider/token.actions.githubusercontent.com"},
  "Action":"sts:AssumeRoleWithWebIdentity",
  "Condition":{"StringEquals":{
     "token.actions.githubusercontent.com:aud":"sts.amazonaws.com",
     "token.actions.githubusercontent.com:sub":"repo:acme/docs:ref:refs/heads/main"}}}]}
Attached policies: inline policy allowing s3:PutObject on arn:aws:s3:::acme-docs-site/*
```
