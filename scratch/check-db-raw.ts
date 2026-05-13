import { Client } from 'pg';
import 'dotenv/config';

async function main() {
  console.log('Connecting to DB with pg directly...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  try {
    await client.connect();
    const res = await client.query('SELECT 1 as connected');
    console.log('Result:', res.rows);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await client.end();
  }
}

main();
