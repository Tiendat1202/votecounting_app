import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'votecounting',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const initializeDatabase = async () => {
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Run schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);
    console.log('✅ Database schema initialized');
    
    client.release();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
};

export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
