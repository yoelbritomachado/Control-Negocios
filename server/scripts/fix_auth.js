const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../inventory.db');
const db = new Database(dbPath);

console.log('--- Current Users ---');
const users = db.prepare('SELECT id, username, email, is_verified, role, pin FROM users').all();
console.table(users);

if (users.length > 0) {
    console.log('--- Fixing Verification ---');
    const update = db.prepare('UPDATE users SET is_verified = 1, role = "admin" WHERE 1=1');
    const info = update.run();
    console.log(`Updated ${info.changes} users to be verified and admins.`);
} else {
    console.log('--- Creating Admin User ---');
    const insert = db.prepare('INSERT INTO users (username, email, pin, is_verified, role, can_edit) VALUES (?, ?, ?, 1, "admin", 1)');
    insert.run('admin', 'admin@mch.com', '1234');
    console.log('Created user: admin / 1234');
}

console.log('--- Updated Users ---');
const updatedUsers = db.prepare('SELECT id, username, email, is_verified, role, pin FROM users').all();
console.table(updatedUsers);
