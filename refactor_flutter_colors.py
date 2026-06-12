import re
import sys
import os

def refactor_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # Define replacements
    replacements = [
        # Primary / Accent
        (r'const Color\(0xFF0066FF\)', 'AppTheme.primaryColor'),
        (r'Color\(0xFF0066FF\)', 'AppTheme.primaryColor'),
        (r'const Color\(0xFF0284C7\)', 'AppTheme.primaryColor'),
        (r'Color\(0xFF0284C7\)', 'AppTheme.primaryColor'),
        (r'const Color\(0xFF0369A1\)', 'AppTheme.primaryColor'),
        (r'Color\(0xFF0369A1\)', 'AppTheme.primaryColor'),
        (r'const Color\(0xFF0A192F\)', 'AppTheme.accentColor'),
        (r'Color\(0xFF0A192F\)', 'AppTheme.accentColor'),
        (r'const Color\(0xFF0C4A6E\)', 'AppTheme.accentColor'),
        (r'Color\(0xFF0C4A6E\)', 'AppTheme.accentColor'),
        
        # Text Primary
        (r'const Color\(0xFF18181B\)', 'AppTheme.textPrimary'),
        (r'Color\(0xFF18181B\)', 'AppTheme.textPrimary'),
        (r'const Color\(0xFF1E293B\)', 'AppTheme.textPrimary'),
        (r'Color\(0xFF1E293B\)', 'AppTheme.textPrimary'),
        
        # Text Secondary
        (r'const Color\(0xFF64748B\)', 'AppTheme.textSecondary'),
        (r'Color\(0xFF64748B\)', 'AppTheme.textSecondary'),
        (r'const Color\(0xFF71717A\)', 'AppTheme.textSecondary'),
        (r'Color\(0xFF71717A\)', 'AppTheme.textSecondary'),
        (r'const Color\(0xFFA1A1AA\)', 'AppTheme.textSecondary'),
        (r'Color\(0xFFA1A1AA\)', 'AppTheme.textSecondary'),
        (r'const Color\(0xFFD4D4D8\)', 'AppTheme.textSecondary'),
        (r'Color\(0xFFD4D4D8\)', 'AppTheme.textSecondary'),
        
        # Borders
        (r'const Color\(0xFFE4E4E7\)', 'AppTheme.borderColor'),
        (r'Color\(0xFFE4E4E7\)', 'AppTheme.borderColor'),
        (r'const Color\(0xFFE2E8F0\)', 'AppTheme.borderColor'),
        (r'Color\(0xFFE2E8F0\)', 'AppTheme.borderColor'),
        (r'const Color\(0xFFF1F5F9\)', 'AppTheme.borderColor'),
        (r'Color\(0xFFF1F5F9\)', 'AppTheme.borderColor'),
        (r'const Color\(0xFFBAE6FD\)', 'AppTheme.borderColor'),
        (r'Color\(0xFFBAE6FD\)', 'AppTheme.borderColor'),
        
        # Backgrounds
        (r'const Color\(0xFFF8FAFC\)', 'AppTheme.backgroundColor'),
        (r'Color\(0xFFF8FAFC\)', 'AppTheme.backgroundColor'),
        (r'const Color\(0xFFFAFAFA\)', 'AppTheme.backgroundColor'),
        (r'Color\(0xFFFAFAFA\)', 'AppTheme.backgroundColor'),
        (r'const Color\(0xFFF0F9FF\)', 'AppTheme.backgroundColor'),
        (r'Color\(0xFFF0F9FF\)', 'AppTheme.backgroundColor'),
        
        # Cleanup any newly created "const AppTheme.primaryColor" which is redundant/invalid
        (r'const AppTheme\.', 'AppTheme.'),
    ]

    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)

    if new_content != content:
        # Add import if not exists
        import_stmt = "import 'package:tenant_app/core/theme/app_theme.dart';"
        if import_stmt not in new_content and 'AppTheme' in new_content:
            # find first import
            import_match = re.search(r"import 'package:flutter/material\.dart';", new_content)
            if import_match:
                new_content = new_content.replace(import_match.group(0), f"{import_match.group(0)}\n{import_stmt}")
            else:
                new_content = import_stmt + "\n" + new_content

        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Refactored: {path}")
    else:
        print(f"No changes: {path}")

# Run on all dart files in features
features_dir = '/home/djust/projects/justhub/tenant_app/lib/features'
for root, dirs, files in os.walk(features_dir):
    for f in files:
        if f.endswith('.dart'):
            refactor_file(os.path.join(root, f))

print("Done.")
