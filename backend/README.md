# Plant Care Backend

Backend proxy service for the Perenual Plant API, designed to work with HubSpot UI Extensions.

## Features

- Proxies requests to Perenual API
- Hides API keys server-side
- CORS-enabled for HubSpot
- Simple REST API

## Endpoints

### GET /api/plants/search?q={query}
Search for plants by name.

**Example:**
```
GET /api/plants/search?q=monstera
```

**Response:**
```json
{
  "data": [
    {
      "id": 123,
      "common_name": "Monstera",
      "scientific_name": ["Monstera deliciosa"],
      "thumbnail": "https://...",
      "watering": "Average",
      "sunlight": ["part shade"]
    }
  ]
}
```

### GET /api/plants/:id
Get detailed information about a specific plant.

**Example:**
```
GET /api/plants/123
```

**Response:**
```json
{
  "id": 123,
  "common_name": "Monstera",
  "scientific_name": "Monstera deliciosa",
  "image": "https://...",
  "watering": "Average",
  "watering_period": "Weekly",
  "sunlight": ["part shade"],
  "care_level": "Easy",
  "description": "...",
  "cycle": "Perennial"
}
```

## Deploy to Railway

1. **Create a new project** on Railway
2. **Connect your GitHub repo** (or deploy from this directory)
3. **Add environment variable:**
   - `PERENUAL_API_KEY`: Your Perenual API key (sk-x9B469207829b086813596)
4. **Deploy** - Railway will auto-detect Node.js and run `npm start`

## Local Development

```bash
cd backend
npm install
npm run build
export PERENUAL_API_KEY=sk-x9B469207829b086813596
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

Server runs on http://localhost:3000

### POST /api/plants/associate
Create a plant custom object and associate it with a contact.

**Body:**
```json
{
  "contactId": "123",
  "plantId": 456,
  "commonName": "Monstera",
  "scientificName": "Monstera deliciosa",
  "watering": "Average",
  "wateringPeriod": "Weekly",
  "sunlight": ["part shade"],
  "careLevel": "Easy",
  "imageUrl": "https://...",
  "description": "..."
}
```

**Response:**
```json
{
  "success": true,
  "plantObjectId": "789",
  "message": "Plant successfully created and associated with contact"
}
```

## Environment Variables

- `PORT`: Port to run on (Railway sets this automatically)
- `PERENUAL_API_KEY`: Your Perenual API key (required)
- `HUBSPOT_ACCESS_TOKEN`: Your HubSpot Private App access token (required for creating plants)
