---
type: llm
---
The facts, from the skill's verified index: the control is IAM.4 ("IAM root user access key should not exist", AWS default severity Critical), and the index maps it to CIS AWS Foundations Benchmark v5.0.0 requirement 1.3. CIS numbering differs between benchmark versions (older versions number the root access key check 1.4 or 1.12), which is why the version must be named.

PASS if the response gives IAM.4 as the Security Hub control AND gives 1.3 as the CIS requirement while naming v5.0.0 (or v5.0), or clearly states that the number depends on the benchmark version and identifies which version each number belongs to.
FAIL if the response gives a different Security Hub control ID, gives a CIS number with no benchmark version, gives 1.4 or 1.12 as the answer for v5.0.0, or presents remembered numbers as verified.
