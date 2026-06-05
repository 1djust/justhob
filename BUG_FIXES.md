# 🐞 Bug Fixes Log

This document serves as the central source of truth for all confirmed bug fixes, root cause analyses, and solutions in the PropertyStack project. 

It works in tandem with the `.agents/skills/` directory: every time a bug is logged here, a summarized rule is added to the relevant AI skill file to ensure the AI natively remembers the fix and prevents future regressions.

---

## 📝 Protocol
1. Bug is found and fixed by AI.
2. Human tests the fix.
3. Human replies: `FIXED`.
4. AI asks: `Can I document this fix?`
5. Human replies: `Yes`.
6. AI logs the fix here AND injects a prevention rule into the relevant skill file.

---

*(Future fixes will be appended below)*
