const { Client } = require('@hubspot/api-client');

const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

if (!accessToken) {
  console.error('Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const hubspotClient = new Client({ accessToken });

async function listCustomObjects() {
  try {
    console.log('Fetching all custom object schemas...\n');

    const result = await hubspotClient.crm.schemas.coreApi.getAll();

    console.log(`Found ${result.results.length} custom object(s):\n`);

    result.results.forEach((schema) => {
      console.log(`- Name: ${schema.name}`);
      console.log(`  ID: ${schema.id}`);
      console.log(`  Labels: ${schema.labels.singular} / ${schema.labels.plural}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error fetching custom objects:', error.message);
    if (error.body) {
      console.error('Details:', JSON.stringify(error.body, null, 2));
    }
    process.exit(1);
  }
}

listCustomObjects();
