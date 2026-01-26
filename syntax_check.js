
const fs = require('fs');
const path = require('path');

try {
    const code = fs.readFileSync('js/modules/pos.js', 'utf8');
    new Function(code);
    console.log("Syntax OK");
} catch (e) {
    console.log("Syntax Error:", e.message);
}
