---
description: Does not load the live-account skill for a Terraform source review.
tags: [negative]
model: sonnet
max_turns: 5
allowed_tools: [Read, Glob, Grep, Skill]
---
Quick review of this Terraform for security problems, I'm about to open a PR:

```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "acme-app-logs"
}

resource "aws_s3_bucket_acl" "logs" {
  bucket = aws_s3_bucket.logs.id
  acl    = "public-read"
}
```
