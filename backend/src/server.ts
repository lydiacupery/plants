import express, { Request, Response } from 'express';
import cors from 'cors';
import { Client } from '@hubspot/api-client';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// CORS configuration - only allow HubSpot domains
const allowedOrigins = [
  'https://app.hubspot.com',
  'https://app-eu1.hubspot.com',
  'https://app.hubspotqa.com',
  /^https:\/\/.*\.hubspot\.com$/,
  /^https:\/\/.*\.hubspotqa\.com$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      }
      return allowed.test(origin);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-HubSpot-Signature'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Use raw body parsing for all requests
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Type definitions for Perenual API responses
interface PerenualPlant {
  id: number;
  common_name: string;
  scientific_name: string[];
  default_image?: {
    thumbnail?: string;
    regular_url?: string;
    original_url?: string;
  };
  watering?: string;
  sunlight?: string[];
}

interface PerenualSearchResponse {
  data: PerenualPlant[];
}

interface PerenualPlantDetails extends PerenualPlant {
  watering_period?: string;
  care_level?: string;
  description?: string;
  cycle?: string;
  attracts?: string[];
  propagation?: string[];
}

interface SimplifiedPlant {
  id: number;
  common_name: string;
  scientific_name: string[];
  thumbnail: string | null;
  watering: string;
  sunlight: string[];
}

interface PlantDetailsResponse {
  id: number;
  common_name: string;
  scientific_name: string;
  image: string | null;
  watering?: string;
  watering_period: string;
  sunlight: string[];
  care_level: string;
  description: string;
  cycle: string;
  attracts: string[];
  propagation: string[];
}

// Health check endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'Plant Care API is running' });
});

// Search plants endpoint
app.get('/api/plants/search', async (req: Request, res: Response) => {
  const { q, indoor } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const apiKey = process.env.PERENUAL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log(`Searching for plants: ${q}, indoor: ${indoor}`);

    // Build URL with indoor filter if specified
    let url = `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(q)}`;
    if (indoor === '1') {
      url += '&indoor=1';
    }

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perenual API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Perenual API error: ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json() as PerenualSearchResponse;

    // Transform the response to a simpler format
    const plants: SimplifiedPlant[] = data.data.map((plant) => ({
      id: plant.id,
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      thumbnail: plant.default_image?.thumbnail || null,
      watering: plant.watering || 'Unknown',
      sunlight: plant.sunlight || []
    }));

    res.json({ data: plants });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search plants' });
  }
});

// Get plant details endpoint
app.get('/api/plants/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const apiKey = process.env.PERENUAL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log(`Fetching plant details for ID: ${id}`);

    const response = await fetch(
      `https://perenual.com/api/v2/species/details/${id}?key=${apiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perenual API error:', response.status, errorText);
      return res.status(response.status).json({
        error: `Perenual API error: ${response.status}`,
        details: errorText
      });
    }

    const plant = await response.json() as PerenualPlantDetails;

    // Return formatted plant details
    const plantDetails: PlantDetailsResponse = {
      id: plant.id,
      common_name: plant.common_name,
      scientific_name: plant.scientific_name?.[0] || plant.scientific_name.join(', '),
      image: plant.default_image?.original_url || plant.default_image?.regular_url || null,
      watering: plant.watering,
      watering_period: plant.watering_period || 'Not specified',
      sunlight: plant.sunlight || [],
      care_level: plant.care_level || 'Unknown',
      description: plant.description || 'No description available',
      cycle: plant.cycle || 'Unknown',
      attracts: plant.attracts || [],
      propagation: plant.propagation || []
    };

    res.json(plantDetails);
  } catch (error) {
    console.error('Details error:', error);
    res.status(500).json({ error: 'Failed to fetch plant details' });
  }
});

// Update plant watering information
app.patch('/api/plants/contact/:contactId/plant/:plantId', async (req: Request, res: Response) => {
  const { contactId, plantId } = req.params;

  // Parse raw buffer body
  let body;
  try {
    if (Buffer.isBuffer(req.body)) {
      const bodyString = req.body.toString('utf8');
      const parsed = JSON.parse(bodyString);
      body = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } else if (typeof req.body === 'string') {
      const parsed = JSON.parse(req.body);
      body = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } else {
      body = req.body;
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  const { wateringPeriod, wateringDays } = body;

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'HubSpot access token not configured' });
  }

  try {
    console.log(`[UPDATE PLANT] Updating plant ${plantId} for contact ${contactId}`);

    const hubspotClient = new Client({ accessToken });

    const updateProperties: any = {};
    if (wateringPeriod) {
      updateProperties.watering_period = wateringPeriod;
    }
    if (wateringDays !== undefined) {
      updateProperties.watering_days = wateringDays.toString();
    }

    await hubspotClient.crm.objects.basicApi.update(
      'p_plants',
      plantId,
      { properties: updateProperties }
    );

    console.log(`[UPDATE PLANT] Successfully updated plant ${plantId}`);

    res.json({
      success: true,
      message: 'Plant watering information updated successfully'
    });
  } catch (error: any) {
    console.error('[UPDATE PLANT] Error occurred:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body
    });

    res.status(500).json({
      error: 'Failed to update plant',
      details: error.message
    });
  }
});

// Remove plant association from contact
app.delete('/api/plants/contact/:contactId/plant/:plantId', async (req: Request, res: Response) => {
  const { contactId, plantId } = req.params;

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'HubSpot access token not configured' });
  }

  try {
    console.log(`[REMOVE PLANT] Removing plant ${plantId} from contact ${contactId}`);

    const hubspotClient = new Client({ accessToken });

    // Remove the association
    await hubspotClient.crm.associations.batchApi.archive(
      'p_plants',
      'contacts',
      {
        inputs: [
          {
            _from: { id: plantId },
            to: { id: contactId },
            type: 'contact_to_plants'
          }
        ]
      }
    );

    console.log(`[REMOVE PLANT] Successfully removed association`);

    res.json({
      success: true,
      message: 'Plant association removed successfully'
    });
  } catch (error: any) {
    console.error('[REMOVE PLANT] Error occurred:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body
    });

    res.status(500).json({
      error: 'Failed to remove plant association',
      details: error.message
    });
  }
});

// Get plants associated with a contact
app.get('/api/plants/contact/:contactId', async (req: Request, res: Response) => {
  const { contactId } = req.params;

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'HubSpot access token not configured' });
  }

  try {
    console.log(`[GET PLANTS] Fetching plants for contact: ${contactId}`);

    const hubspotClient = new Client({ accessToken });

    // First, let's check the schema to see association definitions
    try {
      const schema = await hubspotClient.crm.schemas.coreApi.getById('p_plants');
      console.log(`[GET PLANTS] Plant schema associations:`, JSON.stringify(schema.associations, null, 2));
    } catch (e: any) {
      console.log(`[GET PLANTS] Could not fetch schema:`, e.message);
    }

    // Get associated plants using the associations API
    const associations = await hubspotClient.crm.objects.associationsApi.getAll(
      'contacts',
      contactId,
      'p_plants'
    );

    console.log(`[GET PLANTS] Association response:`, JSON.stringify(associations, null, 2));
    console.log(`[GET PLANTS] Found ${associations.results.length} associated plants`);

    // Fetch details for each plant
    const plantPromises = associations.results.map(async (assoc: any) => {
      const plant = await hubspotClient.crm.objects.basicApi.getById(
        'p_plants',
        assoc.toObjectId || assoc.id,
        ['plant_name', 'scientific_name', 'watering_frequency', 'watering_period',
         'sunlight_requirement', 'care_level', 'image_url', 'perenual_plant_id']
      );
      return plant;
    });

    const plants = await Promise.all(plantPromises);

    res.json({
      plants: plants.map(plant => ({
        id: plant.id,
        plantName: plant.properties.plant_name,
        scientificName: plant.properties.scientific_name,
        wateringFrequency: plant.properties.watering_frequency,
        wateringPeriod: plant.properties.watering_period,
        sunlightRequirement: plant.properties.sunlight_requirement,
        careLevel: plant.properties.care_level,
        imageUrl: plant.properties.image_url,
        perenualPlantId: plant.properties.perenual_plant_id
      }))
    });
  } catch (error: any) {
    console.error('[GET PLANTS] Error occurred:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body
    });

    res.status(500).json({
      error: 'Failed to fetch associated plants',
      details: error.message
    });
  }
});

// Create plant and associate with contact endpoint
app.post('/api/plants/associate', async (req: Request, res: Response) => {
  console.log('[CREATE PLANT] Request received');
  console.log('[CREATE PLANT] Query params:', req.query);
  console.log('[CREATE PLANT] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[CREATE PLANT] Body type:', typeof req.body);
  console.log('[CREATE PLANT] Body is Buffer:', Buffer.isBuffer(req.body));
  console.log('[CREATE PLANT] Content-Type:', req.get('content-type'));

  // Parse raw buffer body
  let body;
  try {
    if (Buffer.isBuffer(req.body)) {
      const bodyString = req.body.toString('utf8');
      console.log('[CREATE PLANT] Raw body string length:', bodyString.length);
      console.log('[CREATE PLANT] Raw body first 100 chars:', bodyString.substring(0, 100));

      // Check if it's double-encoded
      const parsed = JSON.parse(bodyString);
      console.log('[CREATE PLANT] First parse type:', typeof parsed);

      // If it's a string after first parse, parse again
      if (typeof parsed === 'string') {
        body = JSON.parse(parsed);
        console.log('[CREATE PLANT] Double-parsed JSON (was double-encoded)');
      } else {
        body = parsed;
        console.log('[CREATE PLANT] Parsed buffer to JSON');
      }
    } else if (typeof req.body === 'string') {
      const parsed = JSON.parse(req.body);
      if (typeof parsed === 'string') {
        body = JSON.parse(parsed);
        console.log('[CREATE PLANT] Double-parsed string JSON');
      } else {
        body = parsed;
        console.log('[CREATE PLANT] Parsed string to JSON');
      }
    } else {
      body = req.body;
      console.log('[CREATE PLANT] Body already parsed');
    }
    console.log('[CREATE PLANT] Final body type:', typeof body);
    console.log('[CREATE PLANT] Final body keys:', Object.keys(body).slice(0, 10));
  } catch (error) {
    console.error('[CREATE PLANT] Failed to parse body as JSON:', error);
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  const {
    contactId,
    plantId,
    commonName,
    scientificName,
    watering,
    wateringPeriod,
    wateringDays,
    nextWateringDate,
    sunlight,
    careLevel,
    imageUrl,
    description
  } = body;

  console.log('[CREATE PLANT] Extracted contactId:', contactId, 'type:', typeof contactId, 'plantId:', plantId);

  if (!contactId || !plantId) {
    console.log('[CREATE PLANT] Missing required fields in body:', JSON.stringify(body, null, 2));
    return res.status(400).json({ error: 'contactId and plantId are required' });
  }

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'HubSpot access token not configured' });
  }

  try {
    console.log(`[CREATE PLANT] Starting for contact ${contactId}, plant: ${commonName}`);
    console.log(`[CREATE PLANT] Access token present: ${!!accessToken}, length: ${accessToken?.length}`);

    const hubspotClient = new Client({ accessToken });

    // Verify the contact exists first
    try {
      const contact = await hubspotClient.crm.contacts.basicApi.getById(contactId.toString(), []);
      console.log(`[CREATE PLANT] Contact verified, ID: ${contact.id}`);
    } catch (error: any) {
      console.error(`[CREATE PLANT] Contact ${contactId} not found or not accessible:`, error.message);
      return res.status(400).json({
        error: 'Contact not found or not accessible',
        contactId: contactId,
        details: error.message
      });
    }

    // Create custom object for plant
    // Note: watering data comes from the plant details page which fetches fresh data from Perenual
    const plantProperties: any = {
      plant_name: commonName,
      scientific_name: scientificName || '',
      watering_frequency: watering || 'Unknown',
      sunlight_requirement: Array.isArray(sunlight) ? sunlight.join(', ') : sunlight || 'Unknown',
      care_level: careLevel || 'Unknown',
      perenual_plant_id: plantId.toString(),
      image_url: imageUrl || '',
      description: description || ''
    };

    // Add optional fields if provided
    if (wateringDays !== undefined) {
      plantProperties.watering_days = wateringDays.toString();
    }
    if (nextWateringDate) {
      plantProperties.next_watering_date = nextWateringDate;
    }

    console.log(`[CREATE PLANT] Plant properties:`, plantProperties);

    // Create the plant custom object
    console.log(`[CREATE PLANT] Attempting to create plant object...`);
    const plantObject = await hubspotClient.crm.objects.basicApi.create(
      'p_plants', // Use p_ prefix for custom objects
      {
        properties: plantProperties,
        associations: []
      }
    );

    console.log(`[CREATE PLANT] Successfully created plant object with ID: ${plantObject.id}`);

    // Associate the plant with the contact
    // Use v3 associations with the default association label
    console.log(`[CREATE PLANT] Attempting to create association between plant ${plantObject.id} and contact ${contactId}...`);

    try {
      await hubspotClient.crm.associations.batchApi.create(
        'p_plants',
        'contacts',
        {
          inputs: [
            {
              _from: { id: plantObject.id },
              to: { id: contactId.toString() },
              type: 'contact_to_plants' // Use the association name from schema
            }
          ]
        }
      );
    } catch (assocError: any) {
      console.error('[CREATE PLANT] Association error:', {
        message: assocError.message,
        body: assocError.body,
        statusCode: assocError.statusCode
      });
      throw assocError;
    }

    console.log(`[CREATE PLANT] Successfully associated plant ${plantObject.id} with contact ${contactId}`);

    res.json({
      success: true,
      plantObjectId: plantObject.id,
      message: 'Plant successfully created and associated with contact'
    });
  } catch (error: any) {
    console.error('[CREATE PLANT] Error occurred:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body,
      category: error.body?.category,
      fullError: JSON.stringify(error, null, 2)
    });

    if (error.body?.category === 'OBJECT_NOT_FOUND' || error.message?.includes('does not exist')) {
      return res.status(400).json({
        error: 'Plant custom object schema not found. Please create it in HubSpot first.',
        details: error.body
      });
    }

    res.status(500).json({
      error: 'Failed to create plant',
      details: error.message,
      hubspotError: error.body
    });
  }
});

// Workflow action: Water plant endpoint
app.post('/api/workflow/water-plant', async (req: Request, res: Response) => {
  console.log('[WATER PLANT WORKFLOW] Request received');
  console.log('[WATER PLANT WORKFLOW] Headers:', JSON.stringify(req.headers, null, 2));

  // Parse raw buffer body
  let body;
  try {
    if (Buffer.isBuffer(req.body)) {
      const bodyString = req.body.toString('utf8');
      console.log('[WATER PLANT WORKFLOW] Raw body:', bodyString);
      const parsed = JSON.parse(bodyString);
      body = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } else if (typeof req.body === 'string') {
      const parsed = JSON.parse(req.body);
      body = typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
    } else {
      body = req.body;
    }
    console.log('[WATER PLANT WORKFLOW] Parsed body:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.error('[WATER PLANT WORKFLOW] Failed to parse body:', error);
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Extract data from HubSpot workflow action payload
  // HubSpot can send data in different formats, so check multiple possible structures
  const { inputFields, fields, object } = body;

  console.log('[WATER PLANT WORKFLOW] Body structure:', {
    hasInputFields: !!inputFields,
    hasFields: !!fields,
    hasObject: !!object,
    bodyKeys: Object.keys(body)
  });

  // Try to extract plantId and contactId from various possible locations
  let plantId, contactId;

  if (inputFields) {
    plantId = inputFields.plantId;
    contactId = inputFields.contactId;
  } else if (fields) {
    plantId = fields.plantId;
    contactId = fields.contactId;
  } else if (body.plantId) {
    // Direct fields in body
    plantId = body.plantId;
    contactId = body.contactId;
  } else if (object) {
    // Sometimes the object itself contains the IDs
    plantId = object.objectId;
    contactId = object.objectId;
  }

  console.log('[WATER PLANT WORKFLOW] Extracted values:', { plantId, contactId });

  if (!plantId) {
    console.log('[WATER PLANT WORKFLOW] Missing plantId. Full body:', JSON.stringify(body, null, 2));
    return res.status(400).json({
      error: 'plantId is required',
      receivedBody: body,
      debug: 'Check logs for full payload structure'
    });
  }

  // If contactId is empty, we can still proceed - it's optional for this workflow
  // The workflow is running on the plant object, so we have the plantId
  console.log('[WATER PLANT WORKFLOW] Will proceed with plantId:', plantId);

  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'HubSpot access token not configured' });
  }

  try {
    const hubspotClient = new Client({ accessToken });

    // If contactId is not provided, try to get it from associations
    if (!contactId || contactId === '') {
      console.log(`[WATER PLANT WORKFLOW] No contactId provided, looking up associated contact for plant ${plantId}`);

      try {
        const associations = await hubspotClient.crm.objects.associationsApi.getAll(
          'p_plants',
          plantId,
          'contacts'
        );

        if (associations.results && associations.results.length > 0) {
          contactId = (associations.results[0] as any).toObjectId || associations.results[0].id;
          console.log(`[WATER PLANT WORKFLOW] Found associated contact: ${contactId}`);
        } else {
          console.log(`[WATER PLANT WORKFLOW] No associated contact found for plant ${plantId}`);
        }
      } catch (assocError: any) {
        console.log(`[WATER PLANT WORKFLOW] Could not fetch associations:`, assocError.message);
        // Continue without contactId - it's not critical for watering the plant
      }
    }

    console.log(`[WATER PLANT WORKFLOW] Watering plant ${plantId}${contactId ? ` for contact ${contactId}` : ''}`);

    // Get the plant's current watering_days value
    const plant = await hubspotClient.crm.objects.basicApi.getById(
      'p_plants',
      plantId,
      ['watering_days', 'plant_name', 'next_watering_date']
    );

    const wateringDays = plant.properties.watering_days
      ? parseInt(plant.properties.watering_days, 10)
      : 7; // Default to 7 days if not set

    console.log(`[WATER PLANT WORKFLOW] Plant: ${plant.properties.plant_name}, watering every ${wateringDays} days`);

    // Calculate next watering date
    const today = new Date();
    const nextWateringDate = new Date(today);
    nextWateringDate.setDate(today.getDate() + wateringDays);

    const todayString = today.toISOString().split('T')[0];
    const nextWateringDateString = nextWateringDate.toISOString().split('T')[0];

    console.log(`[WATER PLANT WORKFLOW] Today: ${todayString}, Next watering: ${nextWateringDateString}`);

    // Update plant with last watered date and next watering date
    await hubspotClient.crm.objects.basicApi.update(
      'p_plants',
      plantId,
      {
        properties: {
          last_watered_date: todayString,
          next_watering_date: nextWateringDateString
        }
      }
    );

    console.log(`[WATER PLANT WORKFLOW] Successfully updated plant ${plantId}`);

    // Return success response to HubSpot
    res.json({
      outputFields: {
        success: true,
        lastWateredDate: todayString,
        nextWateringDate: nextWateringDateString
      }
    });
  } catch (error: any) {
    console.error('[WATER PLANT WORKFLOW] Error occurred:', {
      message: error.message,
      statusCode: error.statusCode,
      body: error.body
    });

    res.status(500).json({
      error: 'Failed to water plant',
      details: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plant Care API listening on port ${PORT}`);
});
