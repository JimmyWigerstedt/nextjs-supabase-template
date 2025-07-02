const { Pool } = require('pg');

/**
 * @param {string} fieldName
 * @param {string} fieldType
 */
async function addField(fieldName, fieldType = 'VARCHAR') {
  const dbUrl = process.env.INTERNAL_DATABASE_URL;
  const schema = process.env.NC_SCHEMA;
  
  if (!dbUrl) {
    console.error('❌ INTERNAL_DATABASE_URL environment variable is not set');
    process.exit(1);
  }
  
  if (!schema) {
    console.error('❌ NC_SCHEMA environment variable is not set');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    const client = await pool.connect();
    
    // Check if field already exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
    `, [schema, fieldName]);
    
    if (checkResult.rows.length > 0) {
      console.log(`✅ Field '${fieldName}' already exists`);
      client.release();
      return;
    }
    
    // Add the field
    await client.query(`
      ALTER TABLE "${schema}"."userData" 
      ADD COLUMN "${fieldName}" ${fieldType}
    `);
    
    console.log(`✅ Added field '${fieldName}' with type ${fieldType}`);
    client.release();
    
  } catch (error) {
    console.error('❌ Failed to add field:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Usage: node scripts/add-field.js fieldName [fieldType]
const fieldName = process.argv[2];
const fieldType = process.argv[3] || 'VARCHAR';

if (!fieldName) {
  console.error('Usage: node scripts/add-field.js <fieldName> [fieldType]');
  process.exit(1);
}

addField(fieldName, fieldType); 