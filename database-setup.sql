-- Run this against your INTERNAL_DATABASE_URL to create required table
CREATE TABLE IF NOT EXISTS userData (
  UID VARCHAR(255) PRIMARY KEY,
  test1 VARCHAR(255) DEFAULT '',
  test2 VARCHAR(255) DEFAULT ''
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_userData_UID ON userData(UID);
