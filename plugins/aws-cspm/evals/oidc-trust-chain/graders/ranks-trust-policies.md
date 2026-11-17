---
type: llm
---
The facts: gh-deploy trusts the GitHub OIDC provider with only an `aud` condition and no `sub` condition, so a workflow in ANY GitHub repository can assume it, and it has AdministratorAccess, which makes it a serious finding. vendor-audit trusts another account's root with no `sts:ExternalId` condition (confused-deputy exposure), but the role is read-only metadata access, so it is a lower-severity finding. gh-docs-publish is correctly scoped (the `sub` pins a single repo and branch) with a narrow S3 write, so it is not a finding.

PASS if the response rates gh-deploy High or Critical and explains that the missing `sub` condition lets any GitHub repository assume an admin role, AND rates vendor-audit clearly lower than gh-deploy (Low or Medium, noting the missing ExternalId and the read-only scope), AND does not report gh-docs-publish as a real finding (calling it fine, or at most Info, is OK).
FAIL if gh-deploy is missed or rated below High, vendor-audit is rated as high as gh-deploy, or gh-docs-publish is reported as High or Critical.
