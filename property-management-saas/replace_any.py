import glob
import re

files = glob.glob('apps/web/src/**/*.tsx', recursive=True) + glob.glob('apps/web/src/**/*.ts', recursive=True)

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    # onError: (e: any) =>
    content = re.sub(r'onError:\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)', r'onError: (\1: Error)', content)
    # catch (err: any)
    content = re.sub(r'catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)', r'catch (\1)', content)
    # data: any in on("...", (data: any) => )
    content = re.sub(r'\(data:\s*any\)', r'(data: unknown)', content)
    # properties: any[]
    content = re.sub(r'properties:\s*any\[\]', r'properties: unknown[]', content)
    # (f: any) =>
    content = re.sub(r'\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)\s*=>', r'(\1: unknown) =>', content)

    with open(file, 'w') as f:
        f.write(content)

print("Done replacing 'any'")
