---
description: Catches a bucket that is public through an ACL grant even though there is no bucket policy for get-bucket-policy-status to flag.
tags: [triage, s3]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
Read-only output from account 111122223333, already collected, don't run anything. Is acme-partner-drop a problem? The scanner says it is fine.

```
$ aws s3control get-public-access-block --account-id 111122223333
An error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found
$ aws s3api get-public-access-block --bucket acme-partner-drop
An error occurred (NoSuchPublicAccessBlockConfiguration) when calling the GetPublicAccessBlock operation: The public access block configuration was not found
$ aws s3api get-bucket-policy-status --bucket acme-partner-drop
An error occurred (NoSuchBucketPolicy) when calling the GetBucketPolicyStatus operation: The bucket policy does not exist
$ aws s3api get-bucket-ownership-controls --bucket acme-partner-drop
An error occurred (OwnershipControlsNotFoundError) when calling the GetBucketOwnershipControls operation: The bucket ownership controls were not found
$ aws s3api get-bucket-acl --bucket acme-partner-drop
{"Owner":{"ID":"abc123"},"Grants":[{"Grantee":{"Type":"CanonicalUser","ID":"abc123"},"Permission":"FULL_CONTROL"},{"Grantee":{"Type":"Group","URI":"http://acs.amazonaws.com/groups/global/AllUsers"},"Permission":"READ"}]}
```
