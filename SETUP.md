# Plant Care Assistant - Setup Guide

This HubSpot app helps users track plant care by searching the Perenual plant database and associating plants with contacts.

## Features

- Search for plants using the Perenual API
- View detailed plant care information (watering schedule, sunlight needs, care level)
- Associate plants with contacts as custom objects
- Track watering schedules automatically

## Prerequisites

1. HubSpot Developer Account
2. Perenual API Key (get free key at https://perenual.com/docs/api)
3. HubSpot CLI installed

## Setup Steps

### 1. Get Perenual API Key

1. Visit https://perenual.com/docs/api
2. Sign up for a free account
3. Get your API key from the dashboard
4. Free tier includes 100 requests/day

### 2. Configure App Secrets

Add your Perenual API key as a secret:

```bash
# Set the Perenual API key
hs secrets add PERENUAL_API_KEY your_api_key_here
```

### 3. Install Dependencies

```bash
cd src/app/cards
npm install
```

### 4. Upload the Project

From the project root directory:

```bash
hs project upload
```

This will:
- Create the custom "Plants" object in your HubSpot account
- Deploy the app card to the CRM
- Set up the serverless functions

### 5. Install the App

1. Go to your HubSpot account
2. Navigate to Settings > Integrations > Private Apps
3. Find "Plant Care Assistant"
4. Install the app

## File Structure

```
src/app/
├── cards/
│   ├── plant-search-card.jsx          # Main app card UI
│   └── plant-search-card-hsmeta.json  # Card configuration
├── extensions/
│   ├── functions/
│   │   ├── searchPlants.js            # Search Perenual API
│   │   ├── getPlantDetails.js         # Get plant details
│   │   └── createPlantForContact.js   # Create plant custom object
│   └── crm-objects/
│       └── plants.json                 # Plant custom object schema
└── app-hsmeta.json                     # App configuration
```

## Custom Object: Plants

The app creates a custom object with these properties:

- **plant_name** (required): Common name of the plant
- **scientific_name**: Scientific/botanical name
- **watering_frequency**: How often to water (frequent, average, minimum, none)
- **watering_period**: Specific period from Perenual
- **sunlight_requirement**: Amount of sunlight needed
- **care_level**: Difficulty level (easy, moderate, difficult)
- **perenual_plant_id**: Reference to Perenual database
- **image_url**: Plant image
- **description**: Care instructions
- **next_watering_date**: Next scheduled watering
- **last_watered_date**: When plant was last watered
- **date_added**: When added to system

## Usage

1. Open any Contact record in HubSpot CRM
2. Look for the "Plant Care Assistant" card
3. Search for a plant by name (e.g., "Monstera", "Succulent")
4. Click "View Details" on any result
5. Review the care information
6. Click "Add Plant to Contact" to associate it

The plant will be created as a custom object and linked to the contact.

## Next Steps (Optional)

### Add Workflow Automation

You can create workflows to automate reminders:

**Option 1: Simple Task Creation**
- Trigger: When Plant is created
- Action: Create task for first watering

**Option 2: Recurring Reminders**
- Trigger: When `next_watering_date` is in the past
- Action: Create task
- Action: Update `next_watering_date` (add watering period days)
- Enable re-enrollment to repeat

### Display Plant Cards

Create a custom view to show plants needing water:
1. Go to Custom Objects > Plants
2. Create view: "Needs Watering"
3. Filter: `next_watering_date` is less than today
4. Sort by: `next_watering_date`

## Troubleshooting

### "API key not configured" error
- Make sure you set the secret: `hs secrets add PERENUAL_API_KEY your_key`
- Re-upload the project after adding secrets

### "Custom object schema not found" error
- The Plants custom object may not have been created
- Check Settings > Data Management > Objects
- If missing, the object definition may need manual creation

### "No plants found" error
- The Perenual API free tier has 100 requests/day
- Try a different search term (be specific, e.g., "Monstera deliciosa")
- Check that your API key is valid

### Rate limit errors
- Free tier: 100 requests/day
- Wait 24 hours or upgrade your Perenual plan

## API Reference

### Serverless Functions

**searchPlants**
- Parameters: `query` (string)
- Returns: Array of plants with basic info

**getPlantDetails**
- Parameters: `plantId` (number)
- Returns: Detailed plant information

**createPlantForContact**
- Parameters: `contactId`, `plantId`, plant properties
- Returns: Success confirmation and plant object ID

## Support

For issues with:
- HubSpot Developer Platform: https://developers.hubspot.com/docs
- Perenual API: https://perenual.com/docs/api
