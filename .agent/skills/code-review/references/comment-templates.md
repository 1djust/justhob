# Code Review Comment Templates

> Ready-to-use templates for consistent, actionable review feedback.

---

## Severity Icons & Prefixes

| Severity | Icon | Prefix | When to Use |
|----------|------|--------|-------------|
| **Critical** | 🔴 | `BLOCKING` | Data loss, security vuln, crash — must fix before merge |
| **High** | 🟠 | `IMPORTANT` | Bug, perf issue, missing error handling — should fix |
| **Medium** | 🟡 | `SUGGESTION` | Code smell, maintainability — recommend fixing |
| **Low** | 🟢 | `NIT` | Style, naming preference — optional |
| **Question** | ❓ | `QUESTION` | Need author clarification |
| **Praise** | 🌟 | `PRAISE` | Excellent code, good pattern |

---

## Comment Templates

### 🔴 BLOCKING — Security

```markdown
🔴 BLOCKING: [Vulnerability Type] — [File:Line]

**Issue:** [Describe the vulnerability]
**Impact:** [What an attacker could do]
**Fix:**
```[language]
// Before (vulnerable)
[bad code]

// After (safe)
[fixed code]
```
**Ref:** OWASP [Category]
```

### 🔴 BLOCKING — Data Loss

```markdown
🔴 BLOCKING: Potential data loss — [File:Line]

**Issue:** [What could cause data loss]
**Scenario:** [When this would trigger]
**Fix:** [Specific fix with code]
```

### 🟠 IMPORTANT — Bug

```markdown
🟠 IMPORTANT: [Bug type] — [File:Line]

**Issue:** [Describe the bug]
**Reproduction:** [Steps or conditions to trigger]
**Expected:** [What should happen]
**Actual:** [What happens instead]
**Fix:**
```[language]
[suggested fix]
```
```

### 🟠 IMPORTANT — Missing Error Handling

```markdown
🟠 IMPORTANT: Unhandled error path — [File:Line]

**Issue:** [What's not being caught/handled]
**Impact:** [What happens when this fails in production]
**Fix:**
```[language]
try {
  [operation]
} catch (error) {
  [proper handling]
}
```
```

### 🟡 SUGGESTION — Code Smell

```markdown
🟡 SUGGESTION: [Smell type] — [File:Line]

**Current:** [What the code does now]
**Concern:** [Why this is problematic for maintainability]
**Alternative:**
```[language]
[better approach]
```
```

### 🟡 SUGGESTION — Performance

```markdown
🟡 SUGGESTION: Performance improvement — [File:Line]

**Current complexity:** O([current])
**Proposed complexity:** O([better])
**Change:**
```[language]
[optimized approach]
```
**Impact:** [Expected improvement]
```

### 🟢 NIT — Style

```markdown
🟢 NIT: [Preference] — [File:Line]

[Brief suggestion, e.g., "Prefer `const` over `let` here since the value is never reassigned."]
```

### ❓ QUESTION — Clarification

```markdown
❓ QUESTION: [File:Line]

[Question about the code]
- Was [approach X] considered?
- What happens when [edge case]?
- Is this intentional or a TODO?
```

### 🌟 PRAISE — Good Code

```markdown
🌟 PRAISE: [File:Line]

[Specific positive feedback, e.g., "Excellent use of the Strategy pattern here — this will make adding new payment providers trivial."]
```

---

## Review Summary Template

```markdown
## Code Review: [Feature/PR Name]

### 📊 Overview
| Metric | Value |
|--------|-------|
| **Files reviewed** | X |
| **Lines changed** | +Y / -Z |
| **Risk level** | 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low |
| **Verdict** | ✅ Approve / ⚠️ Approve with comments / 🔴 Request changes |

### 🎯 What This Change Does
[1-2 sentence summary of the PR's purpose]

### 🔴 Critical (X)
[List critical issues]

### 🟠 High Priority (X)
[List high priority issues]

### 🟡 Suggestions (X)
[List suggestions]

### 🟢 Nits (X)
[List minor nits]

### 🌟 What's Good
[Positive feedback — always include at least one item]

### ❓ Open Questions
[Questions for the author]

### 📋 Next Steps
- [ ] Fix critical issues
- [ ] Address high-priority items
- [ ] Consider suggestions
- [ ] Re-run automated checks
```

---

## Feedback Etiquette Quick Reference

### Phrasing Guide

| ❌ Avoid | ✅ Prefer |
|----------|----------|
| "This is wrong" | "This could cause [issue] because..." |
| "Why did you do this?" | "Was [alternative] considered here?" |
| "You should have..." | "One approach that works well for this is..." |
| "This doesn't make sense" | "Could you help me understand the intent behind...?" |
| "Bad naming" | "A more descriptive name like `userProfile` would help readability" |
| "Fix this" | "This needs a fix because [reason]. Here's one approach: [suggestion]" |

### General Rules

1. **Critique the code, not the coder** — "This function" not "You wrote"
2. **Be specific** — File, line, exact issue
3. **Explain the why** — Not just what's wrong, but why it matters
4. **Suggest alternatives** — Don't just block; help solve
5. **Acknowledge trade-offs** — "This adds complexity but is worth it because..."
6. **Include positives** — Balance critique with praise
7. **Ask, don't assume** — Use questions for ambiguous cases

---

> **Remember:** Great code reviews are conversations, not verdicts. The goal is shipping better code together.
