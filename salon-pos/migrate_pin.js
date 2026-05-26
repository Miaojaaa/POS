const Database = require('better-sqlite3');
const db = new Database('./dev.db');

try {
  db.exec('ALTER TABLE User ADD COLUMN pin TEXT');
  console.log('Column pin added successfully');
} catch(e) {
  console.log('Column might already exist:', e.message);
}

try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS User_pin_key ON User(pin)');
  console.log('Unique index created on pin');
} catch(e) {
  console.log('Index error:', e.message);
}

db.close();
console.log('Done!');
