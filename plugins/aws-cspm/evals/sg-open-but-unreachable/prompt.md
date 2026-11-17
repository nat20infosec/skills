---
description: Rates the internet-reachable instance with IMDSv1 and an admin role highly, and does not rate an open security group on an unroutable private instance as an internet exposure.
tags: [triage, network]
model: sonnet
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill]
---
I already pulled this from account 111122223333 (us-east-1) with a read-only role, so please don't run anything, just review it. Prowler flagged both security groups below as High. What actually matters?

```
$ aws ec2 describe-security-groups --filters Name=ip-permission.cidr,Values=0.0.0.0/0
[{"Id":"sg-0aaa","Name":"app-ssh-open","Ports":[["tcp",22,22]]},
 {"Id":"sg-0bbb","Name":"web-8080","Ports":[["tcp",8080,8080]]}]

$ aws ec2 describe-instances --query '...'
[{"Id":"i-0priv","Sg":"sg-0aaa","Pub":null,"Subnet":"subnet-priv1","IMDS":"required","Profile":null,"State":"running"},
 {"Id":"i-0web","Sg":"sg-0bbb","Pub":"54.210.17.9","Subnet":"subnet-pub1","IMDS":"optional","Hop":2,
  "Profile":"arn:aws:iam::111122223333:instance-profile/web-admin","State":"running"}]

$ aws iam list-attached-role-policies --role-name web-admin
{"AttachedPolicies":[{"PolicyName":"AdministratorAccess","PolicyArn":"arn:aws:iam::aws:policy/AdministratorAccess"}]}

$ aws ec2 describe-route-tables --query '...'
[{"Rt":"rtb-pub","Subnets":["subnet-pub1"],"Routes":["local","igw-0123456789abcdef0"]},
 {"Rt":"rtb-priv","Subnets":["subnet-priv1"],"Routes":["local","nat-0abc1234567890def"]}]
```
