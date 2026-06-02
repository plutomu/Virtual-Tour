import fs from 'fs';
import path from 'path';

const version = {
  timestamp: Date.now(),
  date: new Date().toISOString()
};

const filePath = path.join(process.cwd(), 'public', 'version.json');

// Pastikan folder public ada
if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
  fs.mkdirSync(path.join(process.cwd(), 'public'));
}

fs.writeFileSync(filePath, JSON.stringify(version, null, 2));
console.log(`✅ Version updated: ${version.date}`);
