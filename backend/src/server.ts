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
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const apiKey = process.env.PERENUAL_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    console.log(`Searching for plants: ${q}`);

    const response = await fetch(
      `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(q)}`
    );

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
      console.log('[CREATE PLANT] Raw body string:', bodyString);
      body = JSON.parse(bodyString);
      console.log('[CREATE PLANT] Parsed buffer to JSON');
    } else if (typeof req.body === 'string') {
      console.log('[CREATE PLANT] Raw body string:', req.body);
      body = JSON.parse(req.body);
      console.log('[CREATE PLANT] Parsed string to JSON');
    } else {
      body = req.body;
      console.log('[CREATE PLANT] Body already parsed');
    }
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
    sunlight,
    careLevel,
    imageUrl,
    description
  } = body;

  if (!contactId || !plantId) {
    console.log('[CREATE PLANT] Missing required fields - contactId:', contactId, 'plantId:', plantId);
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

    // Calculate next watering date
    const nextWateringDate = calculateNextWateringDate(wateringPeriod);

    // Create custom object for plant
    const plantProperties = {
      plant_name: commonName,
      scientific_name: scientificName || '',
      watering_frequency: watering || 'Unknown',
      watering_period: wateringPeriod || 'Unknown',
      sunlight_requirement: Array.isArray(sunlight) ? sunlight.join(', ') : sunlight || 'Unknown',
      care_level: careLevel || 'Unknown',
      perenual_plant_id: plantId.toString(),
      image_url: imageUrl || '',
      description: description || '',
      next_watering_date: nextWateringDate
    };

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

    // Associate the plant with the contact using batch API
    console.log(`[CREATE PLANT] Attempting to create association...`);
    await hubspotClient.crm.associations.batchApi.create(
      'p_plants', // Use p_ prefix for custom objects
      'contacts',
      {
        inputs: [
          {
            _from: { id: plantObject.id },
            to: { id: contactId },
            type: 'p_plants_to_contact'
          }
        ]
      }
    );

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

// Helper function to calculate next watering date
function calculateNextWateringDate(wateringPeriod?: string): string {
  const now = new Date();

  // Map watering periods to days
  const periodToDays: Record<string, number> = {
    daily: 1,
    frequent: 1,
    average: 7,
    minimum: 14,
    none: 30
  };

  const days = periodToDays[wateringPeriod?.toLowerCase() || ''] || 7;

  // Add days to current date
  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + days);

  // Return in ISO format (YYYY-MM-DD)
  return nextDate.toISOString().split('T')[0];
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plant Care API listening on port ${PORT}`);
});
