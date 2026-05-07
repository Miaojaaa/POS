const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.prisma')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      content = content.replace(/Mg/g, 'G');
      content = content.replace(/มิลลิกรัม/g, 'กรัม');
      content = content.replace(/มก\./g, 'ก.');
      content = content.replace(/ \/ 1000/g, '');
      content = content.replace(/ \* 1000/g, '');
      content = content.replace(/placeholder="500000 = 500g"/g, 'placeholder="500"');
      content = content.replace(/placeholder="1000000 = 1kg"/g, 'placeholder="1000"');
      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

replaceInDir(path.join(__dirname, 'src'));
replaceInDir(path.join(__dirname, 'prisma'));
