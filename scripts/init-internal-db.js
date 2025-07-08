import { Pool } from 'pg';

async function initializeInternalDatabase() {
  const dbUrl = process.env.INTERNAL_DATABASE_URL;
  const schema = process.env.NC_SCHEMA;
  
  if (!dbUrl) {
    console.error('❌ INTERNAL_DATABASE_URL environment variable is not set');
    console.log('Please add INTERNAL_DATABASE_URL to your .env.local file');
    process.exit(1);
  }
  
  if (!schema) {
    console.error('❌ NC_SCHEMA environment variable is not set');
    console.log('Please add NC_SCHEMA to your .env.local file');
    process.exit(1);
  }
  
  console.log('🔄 Connecting to internal database...');
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  try {
    const client = await pool.connect();
    
    console.log('✅ Connected to internal database');
    console.log('🔄 Ensuring NocoDB schema exists...');
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    console.log('🔄 Creating userData table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${schema}"."userData" (
        "UID" VARCHAR PRIMARY KEY,
        "test1" VARCHAR,
        "test2" VARCHAR,
        "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "stripeCustomerId" VARCHAR,
        "stripeSubscriptionId" VARCHAR,
        "planName" VARCHAR,
        "subscriptionStatus" VARCHAR
      )
    `);
    
    console.log('✅ userData table created successfully');
    
    // Add Stripe fields to existing table if they don't exist
    console.log('🔄 Ensuring Stripe fields exist...');
    const stripeFields = [
      'stripeCustomerId',
      'stripeSubscriptionId', 
      'planName',
      'subscriptionStatus',
      'currentPeriodStart',
      'currentPeriodEnd',
      'trialEnd',
      'cancelAtPeriodEnd',
      'priceId'
    ];
    
    // Define field types for proper column creation
    const fieldTypes = {
      'stripeCustomerId': 'VARCHAR',
      'stripeSubscriptionId': 'VARCHAR',
      'planName': 'VARCHAR',
      'subscriptionStatus': 'VARCHAR',
      'currentPeriodStart': 'TIMESTAMP',
      'currentPeriodEnd': 'TIMESTAMP',
      'trialEnd': 'TIMESTAMP',
      'cancelAtPeriodEnd': 'BOOLEAN DEFAULT FALSE',
      'priceId': 'VARCHAR'
    };

    for (const field of stripeFields) {
      try {
        // Check if field exists
        const fieldCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = $1 AND table_name = 'userData' AND column_name = $2
        `, [schema, field]);
        
        if (fieldCheck.rows.length === 0) {
          // Field doesn't exist, add it with proper type
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          const fieldType = fieldTypes[field] ?? 'VARCHAR';
          await client.query(`
            ALTER TABLE "${schema}"."userData" 
            ADD COLUMN "${field}" ${fieldType}
          `);
          console.log(`✅ Added field: ${field} (${fieldType})`);
        } else {
          console.log(`✅ Field already exists: ${field}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not add field ${field}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Test the connection
    const result = await client.query(`SELECT COUNT(*) FROM "${schema}"."userData"`);
    console.log(`📊 Current userData records: ${result.rows[0].count}`);
    
    client.release();
    await pool.end();
    
    console.log('🎉 Internal database initialization complete!');
    console.log('You can now run: npm run dev');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

initializeInternalDatabase(); 