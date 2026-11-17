---
description: Loads the skill when the user pastes scanner output and asks which findings matter.
tags: [trigger]
model: sonnet
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
---
Our Security Hub export has 412 findings and my manager wants to know which ones actually matter. Top of the export (already collected, nothing to run):

```
Severity,ControlId,Title,Resource
CRITICAL,EC2.19,Security groups should not allow unrestricted access to ports with high risk,sg-0123
CRITICAL,S3.2,S3 general purpose buckets should block public read access,arn:aws:s3:::acme-site-assets
HIGH,IAM.1,IAM policies should not allow full "*" administrative privileges,arn:aws:iam::111122223333:policy/legacy-all
HIGH,EC2.8,EC2 instances should use IMDSv2,i-0abc
MEDIUM,CloudTrail.1,CloudTrail should be enabled with a multi-Region trail,account
```
