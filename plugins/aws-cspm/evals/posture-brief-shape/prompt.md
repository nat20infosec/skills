---
description: Produces a Posture Brief with an assessment first, per-finding evidence and confidence fields, and a coverage table.
tags: [format]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Give me the findings from this read-only output as a short review document (already collected, don't run anything). Account 111122223333, role audit-ro, us-east-1 only.

```
$ aws s3api get-bucket-policy-status --bucket acme-exports
{"PolicyStatus":{"IsPublic":true}}
$ aws s3api get-public-access-block --bucket acme-exports
An error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found
$ aws s3api get-bucket-policy --bucket acme-exports
{"Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::acme-exports/*"}]}

$ aws ec2 describe-security-groups --region us-east-1 --filters Name=ip-permission.cidr,Values=0.0.0.0/0
[]

$ aws guardduty list-detectors --region us-east-1
An error occurred (AccessDeniedException) when calling the ListDetectors operation: not authorized to perform guardduty:ListDetectors
```
