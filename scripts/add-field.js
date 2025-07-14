import { Pool } from 'pg';

// Allowed PostgreSQL field types for userData table
const ALLOWED_TYPES = [
  'VARCHAR',    // Variable character string
  'TEXT',       // Long text
  'INTEGER',    // 32-bit integer
  'BIGINT',     // 64-bit integer
  'BOOLEAN',    // True/false
  'TIMESTAMP',  // Date and time
  'DATE',       // Date only
  'DECIMAL',    // Exact decimal numbers
  'FLOAT',      // Floating point numbers
  'JSON',       // JSON data
  'JSONB'       // Binary JSON (faster queries)
];

/**
 * @param {string} fieldName
 * @param {string} fieldType
 */
async function addField(fieldName, fieldType = 'VARCHAR') {
  // Validate field type
  const normalizedType = fieldType.toUpperCase();
  if (!ALLOWED_TYPES.includes(normalizedType)) {
    console.error(`❌ Invalid field type '${fieldType}'.`);
    console.error(`   Allowed types: ${ALLOWED_TYPES.join(', ')}`);
    console.error(`   Example: npm run add-field myField TEXT`);
    process.exit(1);
  }
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
      ADD COLUMN "${fieldName}" ${normalizedType}
    `);
    
    console.log(`✅ Added field '${fieldName}' with type ${normalizedType}`);
    client.release();
    
  } catch (error) {
    console.error('❌ Failed to add field:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node scripts/add-field.js <fieldName> [fieldType]');
  process.exit(1);
}

const [fieldName, fieldType = 'VARCHAR'] = args;
if (!fieldName) {
  console.error('Usage: node scripts/add-field.js <fieldName> [fieldType]');
  process.exit(1);
}
await addField(fieldName, fieldType); 