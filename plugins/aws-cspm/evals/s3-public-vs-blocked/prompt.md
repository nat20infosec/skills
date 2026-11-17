---
description: Reports the bucket that is genuinely public and does not report a look-alike bucket whose public policy is neutralized by Block Public Access.
tags: [triage, s3]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Read-only output from an S3 check of account 111122223333, already collected, so no need to run anything. Two buckets have a wildcard principal in their policy. Are either of them actually a problem?

```
$ aws s3control get-public-access-block --account-id 111122223333
An error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found

--- acme-static-assets ---
$ aws s3api get-public-access-block --bucket acme-static-assets
{"PublicAccessBlockConfiguration":{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}}
$ aws s3api get-bucket-policy-status --bucket acme-static-assets
{"PolicyStatus":{"IsPublic":false}}
$ aws s3api get-bucket-policy --bucket acme-static-assets
{"Statement":[{"Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::acme-static-assets/*"}]}
$ aws s3api get-bucket-tagging --bucket acme-static-assets
{"TagSet":[{"Key":"purpose","Value":"cdn-origin"}]}

--- acme-customer-invoices-export ---
$ aws s3api get-public-access-block --bucket acme-customer-invoices-export
An error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found
$ aws s3api get-bucket-policy-status --bucket acme-customer-invoices-export
{"PolicyStatus":{"IsPublic":true}}
$ aws s3api get-bucket-policy --bucket acme-customer-invoices-export
{"Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject","s3:ListBucket"],"Resource":["arn:aws:s3:::acme-customer-invoices-export","arn:aws:s3:::acme-customer-invoices-export/*"]}]}
```
