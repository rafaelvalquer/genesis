const fs = require('fs');
const path = require('path');

function deleteTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip node_modules and .git
      if (['node_modules', '.git', '.gemini', 'dist', 'build'].includes(entry.name)) continue;
      deleteTestFiles(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.includes('.test.')) {
        try {
          fs.unlinkSync(fullPath);
          console.log('Deleted', fullPath);
        } catch (e) {
          console.error('Failed to delete', fullPath, e);
        }
      }
    }
  }
}

const projectRoot = path.resolve(__dirname, '..');
deleteTestFiles(projectRoot);
console.log('Test files cleanup completed.');
