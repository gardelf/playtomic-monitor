const { readFileSync } = require('fs');
const schema = readFileSync('schema_railway.sql', 'utf8');
const stmts = schema.split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));
console.log('Total sentencias:', stmts.length);
stmts.slice(0, 8).forEach((s, i) => console.log(i, s.substring(0, 100)));
