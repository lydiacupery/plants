const { Client } = require('@hubspot/api-client');

const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

if (!accessToken) {
  console.error('Error: HUBSPOT_ACCESS_TOKEN environment variable is required');
  process.exit(1);
}

const hubspotClient = new Client({ accessToken });

async function createPlantsCustomObject() {
  try {
    console.log('Creating Plants custom object schema...');

    const schema = {
      name: 'plants',
      labels: {
        singular: 'Plant',
        plural: 'Plants'
      },
      primaryDisplayProperty: 'plant_name',
      secondaryDisplayProperties: ['scientific_name', 'care_level'],
      searchableProperties: ['plant_name', 'scientific_name'],
      requiredProperties: ['plant_name'],
      properties: [
        {
          name: 'plant_name',
          label: 'Plant Name',
          type: 'string',
          fieldType: 'text',
          description: 'Common name of the plant'
        },
        {
          name: 'scientific_name',
          label: 'Scientific Name',
          type: 'string',
          fieldType: 'text',
          description: 'Scientific/botanical name of the plant'
        },
        {
          name: 'watering_frequency',
          label: 'Watering Frequency',
          type: 'string',
          fieldType: 'text',
          description: 'How often the plant needs to be watered'
        },
        {
          name: 'watering_period',
          label: 'Watering Period',
          type: 'string',
          fieldType: 'text',
          description: 'Specific watering period from Perenual'
        },
        {
          name: 'sunlight_requirement',
          label: 'Sunlight Requirement',
          type: 'string',
          fieldType: 'text',
          description: 'Amount of sunlight needed'
        },
        {
          name: 'care_level',
          label: 'Care Level',
          type: 'string',
          fieldType: 'text',
          description: 'Difficulty level of caring for this plant'
        },
        {
          name: 'perenual_plant_id',
          label: 'Perenual Plant ID',
          type: 'string',
          fieldType: 'text',
          description: 'ID from Perenual API database'
        },
        {
          name: 'image_url',
          label: 'Image URL',
          type: 'string',
          fieldType: 'text',
          description: 'URL to plant image'
        },
        {
          name: 'description',
          label: 'Description',
          type: 'string',
          fieldType: 'textarea',
          description: 'Plant description and care information'
        },
        {
          name: 'next_watering_date',
          label: 'Next Watering Date',
          type: 'date',
          fieldType: 'date',
          description: 'Next scheduled watering date'
        }
      ],
      associatedObjects: ['CONTACT']
    };

    const result = await hubspotClient.crm.schemas.coreApi.create(schema);

    console.log('✅ Successfully created Plants custom object!');
    console.log('Object ID:', result.id);
    console.log('Name:', result.name);
    console.log('Labels:', result.labels);

  } catch (error) {
    if (error.body?.category === 'OBJECT_ALREADY_EXISTS') {
      console.log('ℹ️  Plants custom object already exists');
    } else {
      console.error('❌ Error creating custom object:', error.message);
      if (error.body) {
        console.error('Details:', JSON.stringify(error.body, null, 2));
      }
      process.exit(1);
    }
  }
}

createPlantsCustomObject();
