const { Pool } = require('pg');

async function initializeInternalDatabase() {
  const dbUrl = process.env.INTERNAL_DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ INTERNAL_DATABASE_URL environment variable is not set');
    console.log('Please add INTERNAL_DATABASE_URL to your .env.local file');
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
    console.log('🔄 Creating userData table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS "userData" (
        "UID" VARCHAR PRIMARY KEY,
        "test1" VARCHAR,
        "test2" VARCHAR,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ userData table created successfully');
    
    // Test the connection
    const result = await client.query('SELECT COUNT(*) FROM "userData"');
    console.log(`📊 Current userData records: ${result.rows[0].count}`);
    
    client.release();
    await pool.end();
    
    console.log('🎉 Internal database initialization complete!');
    console.log('You can now run: npm run dev');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error instanceof Error ? error.message : String(error));
    console.log('\nTroubleshooting:');
    console.log('1. Check your INTERNAL_DATABASE_URL is correct');
    console.log('2. Ensure your database server is running');
    console.log('3. Verify your database credentials');
    process.exit(1);
  }
}

// Run the initialization
initializeInternalDatabase(); 