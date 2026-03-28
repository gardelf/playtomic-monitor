const mysql = require('mysql2/promise');
const { readFileSync } = require('fs');
const path = require('path');

async function main() {
  const conn = await mysql.createConnection({
    host: 'gondola.proxy.rlwy.net',
    port: 48757,
    user: 'root',
    password: 'HMDXTMssOSXZfUvsfTdTkHVOwPOFssfn',
    database: 'railway',
    ssl: { rejectUnauthorized: false },
    connectTimeout: 15000
  });

  console.log('Conectado a Railway MySQL!');

  const schema = readFileSync(path.join(__dirname, 'schema_railway.sql'), 'utf8');

  // Separar por punto y coma seguido de salto de línea o fin de archivo
  // Eliminar comentarios de línea completa
  const lines = schema.split('\n');
  const cleanLines = lines.filter(l => !l.trim().startsWith('--'));
  const cleanSchema = cleanLines.join('\n');

  // Dividir por ; al final de línea
  const statements = cleanSchema
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  console.log('Sentencias a ejecutar:', statements.length);

  let ok = 0;
  let errors = 0;

  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok++;
      if (stmt.includes('CREATE TABLE')) {
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
        if (match) console.log(`  OK Tabla: ${match[1]}`);
      } else if (stmt.includes('INSERT INTO')) {
        console.log('  OK Seed insertado');
      } else if (stmt.includes('ALTER TABLE')) {
        console.log('  OK ALTER TABLE ejecutado');
      } else if (stmt.includes('CREATE INDEX')) {
        console.log('  OK INDEX creado');
      }
    } catch(e) {
      if (e.message.includes('already exists') || e.message.includes('Duplicate')) {
        // Ignorar si ya existe
      } else {
        console.error('  ERROR:', e.message.substring(0, 120));
        console.error('  SQL:', stmt.substring(0, 80));
        errors++;
      }
    }
  }

  const [tables] = await conn.query('SHOW TABLES');
  console.log('\n=== RESULTADO ===');
  console.log('Sentencias OK:', ok);
  console.log('Errores:', errors);
  console.log('Tablas en Railway MySQL:', tables.length);
  tables.forEach(t => console.log('  -', Object.values(t)[0]));

  await conn.end();
}

main().catch(console.error);
