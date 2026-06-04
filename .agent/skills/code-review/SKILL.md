---
name: code-review
description: Deep code review methodology with automated scanning. Multi-phase review process, severity classification, stack-specific rules (TypeScript, Next.js, Fastify, Flutter/Dart), anti-pattern detection, and structured feedback. Use when reviewing PRs, auditing code quality, or performing file/codebase reviews.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
version: 1.0
priority: HIGH
---

# Deep Code Review — Methodology & Automation

> **Think like a senior engineer who's been burned by production incidents.** Every review is an opportunity to prevent the next outage.

## 🔧 Runtime Scripts

**Execute for automated validation:**

| Script | Purpose | Usage |
|--------|---------|-------|
| `scripts/code_review.py` | Automated code quality scanner | `python scripts/code_review.py <project_path>` |
| `scripts/code_review.py` | Scan specific files | `python scripts/code_review.py <project_path> --files src/foo.ts src/bar.ts` |
| `scripts/code_review.py` | Scan with specific checks | `python scripts/code_review.py <project_path> --checks complexity,naming,errors,types` |

## 📋 Reference Files

| File | Purpose |
|------|---------|
| [checklists.md](references/checklists.md) | Stack-specific review checklists (TS, Next.js, Fastify, Flutter) |
| [comment-templates.md](references/comment-templates.md) | Review comment templates, severity guide, feedback etiquette |

---

## 1. Review Philosophy

### Mindset

| Principle | Meaning |
|-----------|---------|
| **Prevent, don't fix** | Catch issues before they become incidents |
| **Intent over syntax** | Understand _why_ before judging _how_ |
| **Teach, don't gatekeep** | Every review comment is a learning opportunity |
| **Risk-weighted attention** | Spend 80% of time on 20% of high-risk code |
| **Assume competence** | Author likely had a reason; ask before criticizing |

### Cognitive Biases to Guard Against

| Bias | Trap | Counter |
|------|------|---------|
| **Anchoring** | First issue colors judgment of rest | Review in multiple passes |
| **Bikeshedding** | Debating trivia while missing critical | Severity-first ordering |
| **Recency** | Over-focusing on familiar past bugs | Use systematic checklists |
| **Confirmation** | Only looking for patterns you expect | Devil's advocate pass |
| **Authority** | Trusting senior code without scrutiny | All code gets same review rigor |

---

## 2. Multi-Phase Review Process

### Phase 0: Context Gathering (Before Reading Code)

| Question | Why |
|----------|-----|
| What problem does this solve? | Validate the _need_ for the change |
| What's the expected behavior? | Know what "correct" looks like |
| What components are touched? | Map blast radius |
| Are there related open issues? | Avoid duplicate/conflicting work |
| Is this a hot path? | Calibrate performance scrutiny |

### Phase 1: Architecture & Design (Bird's Eye)

| Check | Ask Yourself |
|-------|-------------|
| **Responsibility** | Does each file/function do ONE thing? |
| **Coupling** | Are components properly decoupled? |
| **Abstraction** | Right level? Not too abstract, not too concrete? |
| **Direction** | Do dependencies flow inward (Clean Architecture)? |
| **Extensibility** | Can this be extended without modifying core? |
| **Data flow** | Is data transformation clear and traceable? |

### Phase 2: Logic & Correctness (Line-by-Line)

| Check | Look For |
|-------|----------|
| **Edge cases** | null, undefined, empty arrays, 0, negative values |
| **Boundary conditions** | Off-by-one, overflow, underflow |
| **Race conditions** | Concurrent access, stale state, async timing |
| **State management** | Stale closures, missing cleanup, memory leaks |
| **Error propagation** | Do errors bubble correctly? Silent failures? |
| **Type safety** | `any` usage, missing generics, unsafe casts |
| **Invariants** | Are assumptions validated at entry points? |

### Phase 3: Reliability & Error Handling

| Check | Criteria |
|-------|----------|
| **Try/catch scope** | Catch at the right granularity |
| **Error types** | Typed errors vs generic `Error` |
| **Fallback behavior** | Graceful degradation on failure |
| **Retry logic** | Exponential backoff? Max retries? |
| **Timeout handling** | All external calls have timeouts |
| **Cleanup** | Resources released in `finally`/cleanup |

### Phase 4: Performance & Scalability

| Check | Red Flags |
|-------|-----------|
| **N+1 queries** | Loop with DB call inside |
| **Unbounded loops** | `while(true)` without exit condition |
| **Memory leaks** | Listeners not removed, refs not cleared |
| **Bundle impact** | Large imports for small features |
| **Premature optimization** | Complex code for negligible gain |
| **Missing pagination** | Fetching all records at once |
| **Caching** | Re-computing expensive results |

### Phase 5: Security (Attack Surface)

| Check | Threat |
|-------|--------|
| **Input validation** | Injection, XSS, path traversal |
| **Auth/authz** | Missing checks, privilege escalation |
| **Secrets exposure** | Hardcoded keys, logged credentials |
| **Data leaks** | PII in responses, verbose errors |
| **CSRF/CORS** | Cross-origin abuse vectors |

> 🔴 **Always run the vulnerability-scanner skill in parallel for security checks.**

### Phase 6: Testing & Observability

| Check | Question |
|-------|----------|
| **Coverage** | Are critical paths tested? |
| **Edge cases** | Are failure modes tested? |
| **Assertions** | Testing behavior, not implementation? |
| **Mocking** | Mocking at right boundaries? |
| **Logging** | Sufficient for debugging production? |
| **Monitoring** | Metrics for new features? |

---

## 3. Severity Classification

| Severity | Icon | Criteria | Blocker? |
|----------|------|----------|----------|
| **Critical** | 🔴 | Data loss, security vuln, crash, corruption | YES — must fix |
| **High** | 🟠 | Bug, performance issue, missing error handling | YES — should fix |
| **Medium** | 🟡 | Code smell, maintainability concern, unclear intent | NO — strongly recommended |
| **Low** | 🟢 | Style nit, naming preference, minor optimization | NO — optional |
| **Question** | ❓ | Unclear intent, needs author explanation | NO — informational |
| **Praise** | 🌟 | Excellent pattern, clever solution, good practice | NO — positive feedback |

### Decision Matrix

```
Can cause data loss or security breach?    → 🔴 CRITICAL
Can cause incorrect behavior in prod?      → 🟠 HIGH
Will make future changes harder/riskier?   → 🟡 MEDIUM
Is it a style/convention preference?       → 🟢 LOW
Am I unsure about the author's intent?     → ❓ QUESTION
Is this really well done?                  → 🌟 PRAISE
```

---

## 4. Stack-Specific Deep Review Rules

### TypeScript / Node.js

| Rule | Bad | Good |
|------|-----|------|
| **No `any`** | `const data: any` | `const data: UserData` |
| **Exhaustive switches** | Missing `default` or cases | `satisfies never` in default |
| **Null safety** | `user.name!` | `user?.name ?? 'Unknown'` |
| **Async errors** | Unhandled `async` | `try/catch` or `.catch()` |
| **Import cost** | `import _ from 'lodash'` | `import groupBy from 'lodash/groupBy'` |

### Next.js (App Router)

| Rule | Check |
|------|-------|
| **Server/Client boundary** | `'use client'` only when needed (hooks, events, browser APIs) |
| **Data fetching** | Server Components for data; no `useEffect` for initial loads |
| **Metadata** | `generateMetadata()` for SEO on all pages |
| **Loading states** | `loading.tsx` / Suspense for async content |
| **Error boundaries** | `error.tsx` for route error handling |
| **Streaming** | Large lists use Suspense boundaries |
| **Server Actions** | Mutations use `'use server'` functions, not API routes |
| **Caching** | Proper `revalidate` / `cache` configuration |

### Fastify (API)

| Rule | Check |
|------|-------|
| **Schema validation** | All routes have JSON Schema / TypeBox for req/res |
| **Plugin isolation** | Routes organized as encapsulated plugins |
| **Error handling** | Custom error handler with structured responses |
| **Decorators** | DI patterns via `fastify.decorate()` |
| **Hooks** | Auth/logging via `preHandler`, `onRequest` hooks |
| **Serialization** | Response schemas for auto-serialization |

### Flutter / Dart

| Rule | Check |
|------|-------|
| **Widget composition** | Small, focused widgets; no 500-line `build()` methods |
| **State management** | Consistent pattern (Riverpod/Bloc/Provider) |
| **Null safety** | Proper null handling, no `!` operator abuse |
| **const constructors** | `const` widgets where possible for performance |
| **Keys** | Proper `Key` usage in lists and animated widgets |
| **Dispose** | Controllers and listeners disposed in `dispose()` |
| **Platform checks** | No hardcoded platform assumptions |

---

## 5. Anti-Pattern Detection

### Critical Anti-Patterns (Auto-Block)

| Pattern | Risk | Fix |
|---------|------|-----|
| God function (>100 lines) | Unmaintainable, untestable | Split by responsibility |
| Deep nesting (>3 levels) | Cognitive overload | Guard clauses, extract functions |
| `any` type proliferation | Type safety destroyed | Proper types, generics |
| Swallowed errors | Silent failures in prod | Log, re-throw, or handle |
| Magic numbers/strings | Unclear intent | Named constants/enums |
| Copy-paste code | DRY violation | Extract shared utility |
| Circular dependencies | Build failures, memory issues | Dependency inversion |
| Uncontrolled side effects | Unpredictable behavior | Pure functions, explicit IO |

### Subtle Anti-Patterns (Flag for Review)

| Pattern | Why It's Bad | Better |
|---------|-------------|--------|
| Boolean parameters | `processUser(true, false)` — unclear | Options object or separate functions |
| String-typed enums | `status === 'active'` — typo-prone | `enum Status { ACTIVE = 'active' }` |
| Leaky abstraction | Internal details exposed in interface | Hide implementation |
| Feature flags in code | `if (isNewUI)` scattered everywhere | Strategy pattern |
| Comments explaining _what_ | `// increment counter` — noise | Self-documenting names |
| Premature abstraction | Abstract class for 1 implementation | Wait for second use case |

---

## 6. Review Output Format

### When Reviewing Code, Structure Output As:

```markdown
## Code Review: [file/feature name]

### 📊 Summary
- **Files reviewed:** X
- **Risk level:** Critical / High / Medium / Low
- **Verdict:** ✅ Approve / ⚠️ Approve with comments / 🔴 Request changes

### 🔴 Critical Issues (Must Fix)
1. **[File:Line]** — Description
   - **Why:** Impact explanation
   - **Fix:** Suggested solution

### 🟠 High Priority
1. **[File:Line]** — Description
   - **Why:** Impact explanation
   - **Fix:** Suggested solution

### 🟡 Suggestions
1. **[File:Line]** — Description
   - **Suggestion:** Improvement idea

### 🟢 Nits
1. **[File:Line]** — Description

### 🌟 Positives
- What was done well

### ❓ Questions for Author
1. **[File:Line]** — Why was this approach chosen?
```

---

## 7. Review Workflow

### For PR/Diff-Based Reviews

```
1. READ PR description → Understand intent
2. CHECK changed files list → Map blast radius
3. REVIEW architecture → Phase 1
4. REVIEW each file → Phases 2-6
5. RUN scripts → Automated checks
6. SYNTHESIZE → Structured output
7. RATE → Overall verdict
```

### For Full File/Codebase Reviews

```
1. IDENTIFY target files/directories
2. RUN code_review.py → Get automated baseline
3. REVIEW high-severity findings first
4. DEEP DIVE → Phases 1-6 on each file
5. CROSS-REFERENCE → Check dependencies between files
6. SYNTHESIZE → Structured output with prioritized findings
```

---

## 8. Review Comment Etiquette

### Do's

| Action | Example |
|--------|---------|
| Be specific | "Line 42: `users` can be null here when..." |
| Explain _why_ | "This creates a race condition because..." |
| Suggest alternatives | "Consider using `Map` instead for O(1) lookup" |
| Ask questions | "Was there a reason you chose X over Y?" |
| Praise good code | "🌟 Clean separation of concerns here" |

### Don'ts

| Action | Why |
|--------|-----|
| "This is wrong" without explanation | Unhelpful, demoralizing |
| Style debates on auto-formattable code | Use Prettier/ESLint instead |
| Rewriting entire functions in comments | Submit a suggestion instead |
| "I would have done it differently" | Irrelevant unless it's a bug |
| Blocking on personal preference | Save it for 🟢 NIT |

---

## 9. Self-Check Before Completing Review

| Check | Question |
|-------|----------|
| ✅ **All phases covered?** | Did I run through Phases 1-6? |
| ✅ **Script run?** | Did I run `code_review.py`? |
| ✅ **Severity correct?** | Are my severity ratings calibrated? |
| ✅ **Actionable?** | Can the author fix every comment? |
| ✅ **Balanced?** | Did I include positives, not just negatives? |
| ✅ **Output structured?** | Does it follow the review output format? |

> 🔴 **Rule:** Never submit a review with only negatives. Find something to praise.
> 🔴 **Rule:** Always run `code_review.py` before manual review for a baseline.

---

> **Remember:** The best code review catches the bugs that tests can't — logic errors, design flaws, and assumptions that will break at 3 AM.
