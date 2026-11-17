---
type: llm
---
The facts: the skill's control index lists IAM.20 among the controls AWS has retired, and says never to cite them.

PASS if the response says IAM.20 is retired or no longer an active control and advises against citing it as a current control (pointing the user to a current replacement check is fine).
FAIL if the response describes IAM.20 as a current, active control, gives it a current severity as if live, or tells the user to cite it.
