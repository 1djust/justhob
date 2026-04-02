const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'apps/web/src');
const urlRegex = /http:\/\/localhost:3001/g;
const replacement = "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}";

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let modifiedFiles = 0;

walkDir(directoryPath, function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.match(urlRegex)) {
      // For string templates extending the URL we just replace it directly.
      // E.g. `http://localhost:3001/api/...` -> `${process.env...}/api/...`
      
      // If it's single quoted we need to convert it to a template literal.
      // Replacing 'http://localhost:3001/api/auth/me' -> `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/me`
      
      // First, find single quotes containing localhost and change them to backticks
      content = content.replace(/'http:\/\/localhost:3001(.*?)'/g, "`http://localhost:3001$1`");
      // Double quotes to backticks
      content = content.replace(/"http:\/\/localhost:3001(.*?)"/g, "`http://localhost:3001$1`");
      
      // Now globally replace the localhost string itself
      content = content.replace(/http:\/\/localhost:3001/g, "${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}");
      
      fs.writeFileSync(filePath, content, 'utf8');
      modifiedFiles++;
      console.log(`Updated: ${filePath}`);
    }
  }
});

console.log(`Successfully updated ${modifiedFiles} files.`);
