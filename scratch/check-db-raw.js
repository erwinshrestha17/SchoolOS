const { Client } = require('/Users/erwin/Projects/SchoolOS/apps/api/node_modules/pg');

async function main() {
  console.log('Connecting to DB with pg directly...');
  const client = new Client({
    connectionString: "postgresql://schoolos:password123@localhost:5433/schoolos_db?schema=public"
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
