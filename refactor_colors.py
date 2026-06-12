import re
import sys
import glob

def refactor_file(path):
    with open(path, 'r') as f:
        content = f.read()

    # Define replacements
    replacements = [
        (r'\bbg-zinc-950\b', 'bg-background'),
        (r'\bbg-zinc-900\b', 'bg-card'),
        (r'\bbg-zinc-800\b', 'bg-secondary'),
        (r'\bbg-zinc-200\b', 'bg-secondary'),
        (r'\bbg-zinc-100\b', 'bg-secondary'),
        (r'\bbg-zinc-50\b', 'bg-secondary/50'),
        
        (r'\bborder-zinc-800\b', 'border-border'),
        (r'\bborder-zinc-200\b', 'border-border'),
        (r'\bborder-zinc-100\b', 'border-border'),
        
        (r'\btext-zinc-600\b', 'text-muted-foreground'),
        (r'\btext-zinc-500\b', 'text-muted-foreground'),
        (r'\btext-zinc-400\b', 'text-muted-foreground'),
        
        (r'\btext-zinc-900\b', 'text-foreground'),
        (r'\btext-zinc-700\b', 'text-foreground'),
        (r'\btext-zinc-300\b', 'text-foreground'),
        (r'\btext-zinc-100\b', 'text-foreground'),
        
        # Blue to primary
        (r'\bbg-blue-600\b', 'bg-primary'),
        (r'\bhover:bg-blue-700\b', 'hover:bg-primary/90'),
        (r'\bhover:bg-blue-600\b', 'hover:bg-primary/90'),
        (r'\btext-blue-700\b', 'text-primary'),
        (r'\btext-blue-600\b', 'text-primary'),
        (r'\btext-blue-500\b', 'text-primary'),
        (r'\btext-blue-400\b', 'text-primary'),
        (r'\bbg-blue-100\b', 'bg-primary/10'),
        (r'\bbg-blue-50\b', 'bg-primary/5'),
        (r'\bdark:bg-blue-900/10\b', 'dark:bg-primary/10'),
        (r'\bdark:bg-blue-900/20\b', 'dark:bg-primary/20'),
        (r'\bdark:bg-blue-900/30\b', 'dark:bg-primary/30'),
        (r'\bdark:bg-blue-900/40\b', 'dark:bg-primary/40'),
        (r'\bdark:bg-blue-900\b', 'dark:bg-primary/20'),
        (r'\bborder-blue-200\b', 'border-primary/20'),
        (r'\bborder-blue-100\b', 'border-primary/10'),
        (r'\bdark:border-blue-800\b', 'dark:border-primary/20'),
        (r'\bdark:border-blue-900/30\b', 'dark:border-primary/30'),
        (r'\bhover:bg-blue-200\b', 'hover:bg-primary/20'),
        (r'\bring-blue-500/50\b', 'ring-ring/50'),

        # Indigo to primary
        (r'\bbg-indigo-600\b', 'bg-primary'),
        (r'\bdark:bg-indigo-400\b', 'dark:bg-primary'),
        (r'\btext-indigo-700\b', 'text-primary'),
        (r'\btext-indigo-600\b', 'text-primary'),
        (r'\bdark:text-indigo-400\b', 'dark:text-primary'),
        (r'\bbg-indigo-100\b', 'bg-primary/10'),
        (r'\bdark:bg-indigo-900/30\b', 'dark:bg-primary/30'),
        (r'\bdark:bg-indigo-900/20\b', 'dark:bg-primary/20'),

        # Rose to destructive
        (r'\bbg-rose-500/20\b', 'bg-destructive/20'),
        (r'\bring-rose-500/20\b', 'ring-destructive/20'),
        (r'\btext-rose-500\b', 'text-destructive'),
        (r'\btext-rose-600\b', 'text-destructive'),
        (r'\bbg-rose-500\b', 'bg-destructive'),
        (r'\bbg-rose-100\b', 'bg-destructive/10'),
        (r'\bdark:bg-rose-900/30\b', 'dark:bg-destructive/30'),
        
        # Emerald to green (success) - we can keep emerald or replace with green-500 if we want, but emerald is fine. Let's keep emerald.

        # Simplify redundant pairs
        (r'\bbg-white dark:bg-card\b', 'bg-card'),
        (r'\bbg-card dark:bg-card\b', 'bg-card'),
        (r'\bbg-secondary dark:bg-secondary\b', 'bg-secondary'),
        (r'\bbg-secondary/50 dark:bg-secondary/50\b', 'bg-secondary/50'),
        (r'\btext-foreground dark:text-foreground\b', 'text-foreground'),
        (r'\btext-foreground dark:text-white\b', 'text-foreground'),
        (r'\btext-muted-foreground dark:text-muted-foreground\b', 'text-muted-foreground'),
        (r'\bborder border-border dark:border-border\b', 'border border-border'),
        (r'\bborder-border dark:border-border\b', 'border-border'),
    ]

    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)

    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        print(f"Refactored: {path}")
    else:
        print(f"No changes: {path}")

files = [
    '/home/djust/projects/justhub/property-management-saas/apps/web/src/components/admin/AdminDashboard.tsx',
    '/home/djust/projects/justhub/property-management-saas/apps/web/src/components/dashboard/DashboardStats.tsx',
    '/home/djust/projects/justhub/property-management-saas/apps/web/src/components/dashboard/RevenueChart.tsx',
    '/home/djust/projects/justhub/property-management-saas/apps/web/src/components/dashboard/Sidebar.tsx',
    '/home/djust/projects/justhub/property-management-saas/apps/web/src/components/dashboard/OverdueTenantsWidget.tsx'
]

for f in files:
    refactor_file(f)

print("Done.")
