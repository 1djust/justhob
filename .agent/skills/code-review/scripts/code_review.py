#!/usr/bin/env python3
"""
Skill: code-review
Script: code_review.py
Purpose: Automated code quality scanner for deep code review

Usage:
    python code_review.py <project_path>
    python code_review.py <project_path> --files src/foo.ts src/bar.ts
    python code_review.py <project_path> --checks complexity,naming,errors,types
    python code_review.py <project_path> --output summary
    python code_review.py <project_path> --severity critical,high

Checks:
    complexity  - Function length, nesting depth, cyclomatic complexity
    naming      - Naming convention violations
    errors      - Error handling anti-patterns
    types       - Type safety issues (any, non-null assertions)
    patterns    - Code anti-patterns (magic numbers, god functions, etc.)
    imports     - Import issues (circular deps indicators, heavy imports)
    async       - Async anti-patterns (fire-and-forget, missing await)
    react       - React/Next.js specific issues
    fastify     - Fastify API specific issues
    flutter     - Flutter/Dart specific issues

Output: JSON with categorized findings
"""
import json
import os
import sys
import re
import argparse
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime
from collections import defaultdict

# Fix console encoding
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass


# ============================================================================
#  CONFIGURATION
# ============================================================================

SKIP_DIRS = {
    'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv',
    '.next', '.turbo', 'coverage', '.dart_tool', '.pub-cache', 'ios', 'android',
    'macos', 'linux', 'windows', 'web', '.agents', '.agent',
}

TS_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
DART_EXTENSIONS = {'.dart'}
ALL_CODE_EXTENSIONS = TS_EXTENSIONS | DART_EXTENSIONS | {'.py'}

# Severity weights for scoring
SEVERITY_WEIGHT = {'critical': 10, 'high': 5, 'medium': 2, 'low': 1}


# ============================================================================
#  INDIVIDUAL CHECKS
# ============================================================================

def check_complexity(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check function length, nesting depth, and parameter count."""
    findings = []
    rel_path = str(filepath)

    # Track function boundaries
    current_func_start = None
    current_func_name = None
    brace_depth = 0
    max_nesting_in_func = 0

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Detect function declarations (TS/JS)
        if ext in TS_EXTENSIONS:
            func_match = re.match(
                r'(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|'
                r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|'
                r'(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{)',
                stripped
            )
            if func_match:
                name = func_match.group(1) or func_match.group(2) or func_match.group(3)
                if current_func_name and current_func_start:
                    func_len = i - current_func_start
                    if func_len > 100:
                        findings.append({
                            'file': rel_path, 'line': current_func_start,
                            'check': 'complexity', 'severity': 'high',
                            'message': f'God function `{current_func_name}` is {func_len} lines (max 100)',
                            'category': 'Function Length'
                        })
                    elif func_len > 50:
                        findings.append({
                            'file': rel_path, 'line': current_func_start,
                            'check': 'complexity', 'severity': 'medium',
                            'message': f'Long function `{current_func_name}` is {func_len} lines (recommended <50)',
                            'category': 'Function Length'
                        })
                current_func_start = i
                current_func_name = name
                max_nesting_in_func = 0

        # Detect function declarations (Dart)
        if ext in DART_EXTENSIONS:
            dart_func = re.match(
                r'(?:Future|Stream|void|int|double|String|bool|Widget|State|List|Map|Set|dynamic)?\s*<?[\w, ]*>?\s*(\w+)\s*\(',
                stripped
            )
            if dart_func and not stripped.startswith('//'):
                name = dart_func.group(1)
                if current_func_name and current_func_start:
                    func_len = i - current_func_start
                    if func_len > 100:
                        findings.append({
                            'file': rel_path, 'line': current_func_start,
                            'check': 'complexity', 'severity': 'high',
                            'message': f'God function `{current_func_name}` is {func_len} lines',
                            'category': 'Function Length'
                        })
                current_func_start = i
                current_func_name = name

        # Nesting depth (brace-based)
        brace_depth += stripped.count('{') - stripped.count('}')
        if brace_depth > max_nesting_in_func:
            max_nesting_in_func = brace_depth
        if brace_depth > 5 and i - (getattr(check_complexity, '_last_nesting_line', 0)) > 5:
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'complexity', 'severity': 'medium',
                'message': f'Deep nesting (depth {brace_depth}). Consider guard clauses or extracting functions.',
                'category': 'Nesting Depth'
            })
            check_complexity._last_nesting_line = i

        # Too many parameters
        param_match = re.search(r'\(([^)]{80,})\)', stripped)
        if param_match:
            params = param_match.group(1).split(',')
            if len(params) > 5:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'complexity', 'severity': 'medium',
                    'message': f'Function has {len(params)} parameters (max 5). Use an options object.',
                    'category': 'Parameter Count'
                })

    return findings


def check_naming(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check naming convention violations."""
    findings = []
    rel_path = str(filepath)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('#'):
            continue

        if ext in TS_EXTENSIONS:
            # Single-letter variables (except loop vars and common ones)
            var_match = re.findall(r'(?:const|let|var)\s+([a-zA-Z])\s*[=:]', stripped)
            for v in var_match:
                if v not in ('_', 'i', 'j', 'k', 'x', 'y', 'z', 'e', 'a', 'b'):
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'naming', 'severity': 'low',
                        'message': f'Single-letter variable `{v}`. Use a descriptive name.',
                        'category': 'Variable Naming'
                    })

            # Boolean vars without is/has/should/can prefix
            bool_match = re.findall(r'(?:const|let|var)\s+(\w+)\s*(?::\s*boolean\s*)?=\s*(?:true|false)', stripped)
            for name in bool_match:
                if not re.match(r'^(is|has|should|can|will|did|was)', name):
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'naming', 'severity': 'low',
                        'message': f'Boolean `{name}` should use prefix: is/has/should/can (e.g., `is{name[0].upper()}{name[1:]}`)',
                        'category': 'Boolean Naming'
                    })

        if ext in DART_EXTENSIONS:
            # Private members should start with _
            pub_field = re.match(r'\s+(int|double|String|bool|List|Map|Set|var|dynamic)\s+([a-z]\w*)\s*[;=]', line)
            if pub_field and not line.strip().startswith('//'):
                pass  # Dart allows public fields, just note for context

    return findings


def check_error_handling(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check error handling anti-patterns."""
    findings = []
    rel_path = str(filepath)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Empty catch blocks
        if ext in TS_EXTENSIONS:
            if re.match(r'}\s*catch\s*\(\s*\w*\s*\)\s*\{\s*\}', stripped):
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'errors', 'severity': 'high',
                    'message': 'Empty catch block — errors silently swallowed. Log, re-throw, or handle.',
                    'category': 'Swallowed Error'
                })

            # catch with only console.log (no re-throw or proper handling)
            if re.match(r'}\s*catch\s*\(', stripped):
                # Check next few lines for just console.log
                next_lines = ''.join(lines[i:i+3]) if i < len(lines) - 2 else ''
                if 'console.log' in next_lines and 'throw' not in next_lines and 'return' not in next_lines:
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'errors', 'severity': 'medium',
                        'message': 'Catch block only logs error. Consider re-throwing or returning error response.',
                        'category': 'Weak Error Handling'
                    })

        if ext in DART_EXTENSIONS:
            # Empty catch in Dart
            if re.match(r'}\s*catch\s*\(\s*\w*\s*\)\s*\{\s*\}', stripped):
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'errors', 'severity': 'high',
                    'message': 'Empty catch block in Dart. Handle or rethrow.',
                    'category': 'Swallowed Error'
                })
            # catch (e) { } or on Exception catch (e) { }
            if re.match(r'on\s+Exception\s+catch', stripped):
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'errors', 'severity': 'medium',
                    'message': 'Catching generic `Exception`. Catch specific types when possible.',
                    'category': 'Generic Catch'
                })

        # Missing error handling on promises (TS/JS)
        if ext in TS_EXTENSIONS:
            if re.search(r'\.then\s*\(', stripped) and '.catch' not in stripped:
                # Check next few lines for .catch
                next_chunk = ''.join(lines[i:i+5]) if i < len(lines) - 4 else ''
                if '.catch' not in next_chunk:
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'errors', 'severity': 'medium',
                        'message': 'Promise `.then()` without `.catch()`. Unhandled rejection risk.',
                        'category': 'Unhandled Promise'
                    })

    return findings


def check_type_safety(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check type safety issues in TypeScript."""
    findings = []
    rel_path = str(filepath)

    if ext not in TS_EXTENSIONS:
        return findings

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue

        # `any` type usage
        any_matches = re.findall(r':\s*any\b', stripped)
        if any_matches:
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'types', 'severity': 'high',
                'message': '`any` type used. Use `unknown` and narrow, or define a proper type.',
                'category': 'Any Type'
            })

        # as any cast
        if 'as any' in stripped:
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'types', 'severity': 'high',
                'message': '`as any` cast bypasses type safety. Use proper type narrowing.',
                'category': 'Unsafe Cast'
            })

        # Non-null assertion
        nna = re.findall(r'\w+!\.', stripped)
        if nna and not stripped.startswith('//'):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'types', 'severity': 'medium',
                'message': 'Non-null assertion (`!`). Use optional chaining (`?.`) or null check.',
                'category': 'Non-Null Assertion'
            })

        # @ts-ignore / @ts-expect-error without explanation
        if re.search(r'@ts-ignore|@ts-expect-error', stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'types', 'severity': 'medium',
                'message': 'TypeScript directive suppresses type checking. Add a comment explaining why.',
                'category': 'Type Suppression'
            })

    return findings


def check_patterns(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check code anti-patterns."""
    findings = []
    rel_path = str(filepath)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('#'):
            continue

        # Magic numbers (numeric literals not in obvious contexts)
        if ext in TS_EXTENSIONS | DART_EXTENSIONS:
            magic_nums = re.findall(r'(?<!=\s)(?<![.\w])\b(\d{2,})\b(?!\s*[;,\]})]?\s*//)', stripped)
            for num in magic_nums:
                if num not in ('100', '200', '201', '204', '301', '302', '400', '401',
                               '403', '404', '500', '1000', '1024', '10', '60', '24',
                               '255', '256', '0', '1', '2', '99'):
                    # Skip if it's in an obvious context
                    if not re.search(r'(port|status|code|timeout|delay|index|length|size|count|width|height|padding|margin|radius|offset)\s*[=:]\s*' + num, stripped, re.IGNORECASE):
                        findings.append({
                            'file': rel_path, 'line': i,
                            'check': 'patterns', 'severity': 'low',
                            'message': f'Magic number `{num}`. Extract to a named constant.',
                            'category': 'Magic Number'
                        })
                        break  # One per line

        # Commented-out code
        if ext in TS_EXTENSIONS:
            if re.match(r'//\s*(const|let|var|function|class|import|export|if|for|while|return|await)\s', stripped):
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'patterns', 'severity': 'low',
                    'message': 'Commented-out code. Remove it — version control preserves history.',
                    'category': 'Dead Code'
                })

        # console.log left in production code
        if ext in TS_EXTENSIONS:
            if re.match(r'console\.(log|debug|info)\s*\(', stripped):
                # Skip if in a test file
                if '.test.' not in str(filepath) and '.spec.' not in str(filepath):
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'patterns', 'severity': 'low',
                        'message': '`console.log` in production code. Use a proper logger.',
                        'category': 'Debug Logging'
                    })

        # TODO/FIXME/HACK without issue reference
        todo_match = re.search(r'(TODO|FIXME|HACK|XXX)\s*:?\s*(.*)', stripped)
        if todo_match:
            comment = todo_match.group(2)
            if not re.search(r'(#\d+|ISSUE-|JIRA-|ticket)', comment, re.IGNORECASE):
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'patterns', 'severity': 'low',
                    'message': f'`{todo_match.group(1)}` without issue reference. Link to a tracking issue.',
                    'category': 'Untracked TODO'
                })

    return findings


def check_imports(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check import issues."""
    findings = []
    rel_path = str(filepath)

    if ext not in TS_EXTENSIONS:
        return findings

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Heavy wildcard imports
        if re.match(r"import\s+\*\s+as\s+\w+\s+from\s+['\"]", stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'imports', 'severity': 'medium',
                'message': 'Wildcard import `import *`. Use named imports for tree-shaking.',
                'category': 'Wildcard Import'
            })

        # Full lodash import
        if re.search(r"from\s+['\"]lodash['\"]", stripped) and 'import {' not in stripped:
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'imports', 'severity': 'high',
                'message': 'Full lodash import. Use `lodash/functionName` for smaller bundles.',
                'category': 'Heavy Import'
            })

        # Relative imports going up too many levels
        deep_relative = re.search(r"from\s+['\"](\.\./\.\./\.\./)", stripped)
        if deep_relative:
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'imports', 'severity': 'low',
                'message': 'Deep relative import (../../../). Use path aliases (`@/`).',
                'category': 'Deep Relative Import'
            })

    return findings


def check_async_patterns(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check async anti-patterns."""
    findings = []
    rel_path = str(filepath)

    if ext not in TS_EXTENSIONS:
        return findings

    content = ''.join(lines)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # async function without try/catch or .catch
        if re.match(r'(?:export\s+)?async\s+function', stripped):
            # Check if function body has try/catch
            func_body = ''.join(lines[i:i+30])
            if 'try' not in func_body and '.catch' not in func_body:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'async', 'severity': 'medium',
                    'message': 'Async function without try/catch. Unhandled rejection risk.',
                    'category': 'Unprotected Async'
                })

        # Sequential awaits that could be parallel
        if stripped.startswith('await ') and i < len(lines):
            next_stripped = lines[i].strip() if i < len(lines) else ''
            if next_stripped.startswith('await '):
                # Check if they're independent
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'async', 'severity': 'low',
                    'message': 'Sequential `await` calls. If independent, use `Promise.all()` for parallelism.',
                    'category': 'Sequential Await'
                })

        # setTimeout/setInterval without cleanup
        if re.search(r'setInterval\s*\(', stripped):
            # Check surrounding context for clearInterval
            surrounding = ''.join(lines[max(0, i-10):i+10])
            if 'clearInterval' not in surrounding:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'async', 'severity': 'medium',
                    'message': '`setInterval` without `clearInterval`. Potential memory leak.',
                    'category': 'Uncleaned Interval'
                })

    return findings


def check_react_patterns(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check React/Next.js specific issues."""
    findings = []
    rel_path = str(filepath)

    if ext not in {'.tsx', '.jsx'}:
        return findings

    content = ''.join(lines)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # useEffect with missing deps (simplified heuristic)
        if 'useEffect(' in stripped:
            # Check for empty dep array with references to state/props
            effect_block = ''.join(lines[i:i+15])
            if re.search(r'\[\s*\]', effect_block):
                # Has empty deps — might be intentional but flag for review
                pass  # Too many false positives to flag

        # useState with object (should consider useReducer)
        if re.search(r'useState\s*<\s*\{', stripped) or re.search(r'useState\s*\(\s*\{', stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'react', 'severity': 'low',
                'message': '`useState` with complex object. Consider `useReducer` for complex state.',
                'category': 'Complex State'
            })

        # Inline function in JSX (potential re-render trigger)
        if re.search(r'on\w+\s*=\s*\{\s*\(\)\s*=>', stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'react', 'severity': 'low',
                'message': 'Inline arrow function in JSX prop. Extract to `useCallback` if in a list.',
                'category': 'Inline Handler'
            })

        # Missing key prop indicator in map
        if '.map(' in stripped and 'key=' not in ''.join(lines[i:i+5]):
            pass  # Handled by ESLint usually

        # Direct DOM manipulation in React
        if re.search(r'document\.(getElementById|querySelector|getElementsBy)', stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'react', 'severity': 'high',
                'message': 'Direct DOM manipulation in React component. Use refs instead.',
                'category': 'DOM Manipulation'
            })

    # File-level checks
    has_use_client = "'use client'" in content or '"use client"' in content
    has_use_effect = 'useEffect' in content
    has_use_state = 'useState' in content

    # useEffect for data fetching in Next.js (should use Server Component)
    if has_use_client and has_use_effect:
        for i, line in enumerate(lines, 1):
            if 'useEffect' in line:
                effect_body = ''.join(lines[i:i+10])
                if re.search(r'fetch\(|axios|useSWR|useQuery', effect_body):
                    findings.append({
                        'file': rel_path, 'line': i,
                        'check': 'react', 'severity': 'medium',
                        'message': 'Data fetching in `useEffect`. In Next.js, prefer Server Components for initial data.',
                        'category': 'Client Data Fetching'
                    })
                    break

    return findings


def check_fastify_patterns(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check Fastify API specific issues."""
    findings = []
    rel_path = str(filepath)

    if ext not in TS_EXTENSIONS:
        return findings

    content = ''.join(lines)

    # Only check files that look like Fastify routes/plugins
    if 'fastify' not in content.lower() and 'FastifyInstance' not in content:
        return findings

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Route without schema validation
        route_match = re.search(r'\.(get|post|put|patch|delete)\s*\(\s*[\'"]', stripped)
        if route_match:
            # Check next ~15 lines for schema
            route_block = ''.join(lines[i:i+15])
            if 'schema' not in route_block:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'fastify', 'severity': 'high',
                    'message': f'Route `{route_match.group(1).upper()}` missing schema validation. Add JSON Schema or TypeBox.',
                    'category': 'Missing Schema'
                })

        # Returning raw error messages to client
        if re.search(r'reply\s*\.\s*send\s*\(\s*\{\s*error\s*:\s*(?:err|error|e)\.message', stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'fastify', 'severity': 'medium',
                'message': 'Raw error message sent to client. Could leak internal details.',
                'category': 'Error Leakage'
            })

    return findings


def check_flutter_patterns(filepath: Path, lines: List[str], ext: str) -> List[Dict]:
    """Check Flutter/Dart specific issues."""
    findings = []
    rel_path = str(filepath)

    if ext not in DART_EXTENSIONS:
        return findings

    content = ''.join(lines)

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Bang operator (!) abuse
        bang_matches = re.findall(r'(\w+)!\.', stripped)
        if bang_matches and not stripped.startswith('//'):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'flutter', 'severity': 'medium',
                'message': f'Null assertion operator (`!`) on `{bang_matches[0]}`. Use `?.` or null check.',
                'category': 'Null Assertion'
            })

        # setState after async without mounted check
        if 'setState' in stripped:
            # Check if there's an await in the surrounding context
            prev_lines = ''.join(lines[max(0, i-10):i])
            if 'await' in prev_lines and 'mounted' not in prev_lines:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'flutter', 'severity': 'high',
                    'message': '`setState` after `await` without `mounted` check. May crash if widget is disposed.',
                    'category': 'Async SetState'
                })

        # BuildContext across async gap
        if re.search(r'await\s+.*context', stripped) or ('await' in stripped and 'context' in stripped):
            findings.append({
                'file': rel_path, 'line': i,
                'check': 'flutter', 'severity': 'high',
                'message': '`BuildContext` used across async gap. Context may be invalid after await.',
                'category': 'Async Context'
            })

        # Large build method indicator
        if re.match(r'\s*Widget\s+build\s*\(', stripped):
            # Count lines until next top-level declaration
            build_lines = 0
            for j in range(i, min(i + 300, len(lines))):
                build_lines += 1
                if j > i + 5 and re.match(r'\s*(?:Widget|void|Future|Stream|@override)', lines[j]):
                    break
            if build_lines > 100:
                findings.append({
                    'file': rel_path, 'line': i,
                    'check': 'flutter', 'severity': 'medium',
                    'message': f'`build()` method is ~{build_lines} lines. Extract sub-widgets.',
                    'category': 'Large Build Method'
                })

    # File-level: missing dispose
    if 'State<' in content:
        has_controller = bool(re.search(r'(TextEditingController|AnimationController|ScrollController|TabController|FocusNode)', content))
        has_dispose = 'dispose()' in content
        if has_controller and not has_dispose:
            findings.append({
                'file': rel_path, 'line': 1,
                'check': 'flutter', 'severity': 'high',
                'message': 'StatefulWidget has controllers but no `dispose()` method. Memory leak risk.',
                'category': 'Missing Dispose'
            })

    return findings


# ============================================================================
#  FILE SCANNER
# ============================================================================

def get_applicable_checks(ext: str, requested_checks: Optional[List[str]] = None) -> List:
    """Get applicable check functions based on file extension and requested checks."""
    all_checks = {
        'complexity': check_complexity,
        'naming': check_naming,
        'errors': check_error_handling,
        'types': check_type_safety,
        'patterns': check_patterns,
        'imports': check_imports,
        'async': check_async_patterns,
        'react': check_react_patterns,
        'fastify': check_fastify_patterns,
        'flutter': check_flutter_patterns,
    }

    if requested_checks:
        return [(name, fn) for name, fn in all_checks.items() if name in requested_checks]

    # Auto-select based on extension
    checks = [
        ('complexity', check_complexity),
        ('naming', check_naming),
        ('errors', check_error_handling),
        ('patterns', check_patterns),
    ]

    if ext in TS_EXTENSIONS:
        checks.extend([
            ('types', check_type_safety),
            ('imports', check_imports),
            ('async', check_async_patterns),
        ])
    if ext in {'.tsx', '.jsx'}:
        checks.append(('react', check_react_patterns))
    if ext in TS_EXTENSIONS:
        checks.append(('fastify', check_fastify_patterns))
    if ext in DART_EXTENSIONS:
        checks.append(('flutter', check_flutter_patterns))

    return checks


def scan_file(filepath: Path, project_path: Path, requested_checks: Optional[List[str]] = None) -> List[Dict]:
    """Scan a single file for code quality issues."""
    ext = filepath.suffix.lower()
    if ext not in ALL_CODE_EXTENSIONS:
        return []

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception:
        return []

    if len(lines) == 0:
        return []

    checks = get_applicable_checks(ext, requested_checks)
    findings = []

    for check_name, check_fn in checks:
        try:
            results = check_fn(filepath.relative_to(project_path), lines, ext)
            findings.extend(results)
        except Exception as e:
            findings.append({
                'file': str(filepath.relative_to(project_path)),
                'line': 0, 'check': check_name, 'severity': 'low',
                'message': f'Check `{check_name}` failed: {str(e)[:80]}',
                'category': 'Scanner Error'
            })

    return findings


# ============================================================================
#  MAIN
# ============================================================================

def collect_files(project_path: Path, specific_files: Optional[List[str]] = None) -> List[Path]:
    """Collect files to scan."""
    if specific_files:
        return [project_path / f for f in specific_files if (project_path / f).exists()]

    files = []
    for root, dirs, filenames in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for filename in filenames:
            ext = Path(filename).suffix.lower()
            if ext in ALL_CODE_EXTENSIONS:
                filepath = Path(root) / filename
                # Skip test files unless explicitly targeted
                if '.test.' not in filename and '.spec.' not in filename and '__test__' not in str(filepath):
                    files.append(filepath)
    return files


def run_review(
    project_path: str,
    specific_files: Optional[List[str]] = None,
    requested_checks: Optional[List[str]] = None,
    severity_filter: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Execute automated code review."""
    proj = Path(project_path).resolve()

    report: Dict[str, Any] = {
        'script': 'code_review',
        'project': str(proj),
        'timestamp': datetime.now().isoformat(),
        'files_scanned': 0,
        'findings': [],
        'summary': {
            'total': 0,
            'by_severity': {'critical': 0, 'high': 0, 'medium': 0, 'low': 0},
            'by_check': defaultdict(int),
            'by_category': defaultdict(int),
            'score': 100,
            'verdict': '✅ CLEAN'
        }
    }

    files = collect_files(proj, specific_files)
    report['files_scanned'] = len(files)

    for filepath in files:
        findings = scan_file(filepath, proj, requested_checks)
        report['findings'].extend(findings)

    # Apply severity filter
    if severity_filter:
        report['findings'] = [f for f in report['findings'] if f['severity'] in severity_filter]

    # Deduplicate similar findings (same file, same line, same check)
    seen = set()
    unique_findings = []
    for f in report['findings']:
        key = (f['file'], f.get('line', 0), f['check'], f.get('category', ''))
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)
    report['findings'] = unique_findings

    # Build summary
    report['summary']['total'] = len(report['findings'])
    for f in report['findings']:
        sev = f['severity']
        report['summary']['by_severity'][sev] = report['summary']['by_severity'].get(sev, 0) + 1
        report['summary']['by_check'][f['check']] += 1
        report['summary']['by_category'][f.get('category', 'Unknown')] += 1

    # Calculate quality score (100 - weighted deductions)
    deductions = sum(
        SEVERITY_WEIGHT.get(f['severity'], 1) for f in report['findings']
    )
    report['summary']['score'] = max(0, 100 - deductions)

    # Verdict
    score = report['summary']['score']
    crit = report['summary']['by_severity']['critical']
    high = report['summary']['by_severity']['high']

    if crit > 0:
        report['summary']['verdict'] = f'🔴 CRITICAL — {crit} critical issue(s) found'
    elif high > 0:
        report['summary']['verdict'] = f'🟠 NEEDS WORK — {high} high priority issue(s)'
    elif score >= 80:
        report['summary']['verdict'] = '✅ GOOD — minor suggestions only'
    elif score >= 60:
        report['summary']['verdict'] = '🟡 FAIR — several improvements recommended'
    else:
        report['summary']['verdict'] = '🟠 NEEDS ATTENTION — significant issues found'

    # Convert defaultdicts to regular dicts for JSON serialization
    report['summary']['by_check'] = dict(report['summary']['by_check'])
    report['summary']['by_category'] = dict(report['summary']['by_category'])

    return report


def print_summary(report: Dict[str, Any]) -> None:
    """Print human-readable summary."""
    s = report['summary']

    print(f"\n{'='*60}")
    print(f"[CODE REVIEW] Automated Quality Scan")
    print(f"{'='*60}")
    print(f"Project:  {report['project']}")
    print(f"Time:     {report['timestamp']}")
    print(f"Files:    {report['files_scanned']}")
    print(f"Findings: {s['total']}")
    print(f"Score:    {s['score']}/100")
    print(f"Verdict:  {s['verdict']}")
    print(f"{'-'*60}")

    # By severity
    print(f"\n📊 By Severity:")
    for sev in ['critical', 'high', 'medium', 'low']:
        count = s['by_severity'].get(sev, 0)
        if count > 0:
            icon = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🟢'}[sev]
            print(f"  {icon} {sev.upper()}: {count}")

    # By category (top 10)
    if s['by_category']:
        print(f"\n📋 Top Categories:")
        sorted_cats = sorted(s['by_category'].items(), key=lambda x: x[1], reverse=True)[:10]
        for cat, count in sorted_cats:
            print(f"  • {cat}: {count}")

    # Top findings (critical and high only)
    critical_high = [f for f in report['findings'] if f['severity'] in ('critical', 'high')]
    if critical_high:
        print(f"\n🔴 Critical & High Priority Findings:")
        for f in critical_high[:15]:
            icon = '🔴' if f['severity'] == 'critical' else '🟠'
            print(f"  {icon} [{f['file']}:{f.get('line', '?')}] {f['message']}")

    print(f"\n{'='*60}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description='Automated code quality scanner for deep code review'
    )
    parser.add_argument('project_path', nargs='?', default='.', help='Project directory to scan')
    parser.add_argument('--files', nargs='+', help='Specific files to scan (relative to project)')
    parser.add_argument('--checks', help='Comma-separated checks: complexity,naming,errors,types,patterns,imports,async,react,fastify,flutter')
    parser.add_argument('--severity', help='Filter by severity: critical,high,medium,low')
    parser.add_argument('--output', choices=['json', 'summary'], default='summary', help='Output format')

    args = parser.parse_args()

    if not os.path.isdir(args.project_path):
        print(json.dumps({'error': f'Directory not found: {args.project_path}'}))
        sys.exit(1)

    requested_checks = args.checks.split(',') if args.checks else None
    severity_filter = args.severity.split(',') if args.severity else None

    report = run_review(
        args.project_path,
        specific_files=args.files,
        requested_checks=requested_checks,
        severity_filter=severity_filter
    )

    if args.output == 'summary':
        print_summary(report)
        # Also print JSON for agent consumption
        print(f"\n{json.dumps(report, indent=2)}")
    else:
        print(json.dumps(report, indent=2))

    # Exit code based on findings
    if report['summary']['by_severity']['critical'] > 0:
        sys.exit(2)
    elif report['summary']['by_severity']['high'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
