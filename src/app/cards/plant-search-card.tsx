import React, { useState } from "react";
import type { FC } from "react";
import {
  Text,
  Input,
  Button,
  Flex,
  Divider,
  Image,
  LoadingSpinner,
  Alert,
  Box,
  Heading
} from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

interface Plant {
  id: number;
  common_name: string;
  scientific_name?: string[];
  thumbnail?: string;
  watering?: string;
  sunlight?: string[];
}

interface PlantDetails extends Plant {
  image?: string;
  watering_period?: string;
  care_level?: string;
  description?: string;
}

interface ServerlessResponse {
  error?: string;
  data?: Plant[];
  success?: boolean;
}

interface ExtensionProps {
  actions: {
    serverless: (params: { functionName: string; parameters: Record<string, any> }) => Promise<any>;
    addAlert: (alert: { type: string; message: string }) => void;
  };
  context: {
    crm?: {
      objectId?: string;
    };
  };
}

hubspot.extend(({ actions, context }) => (
  <PlantSearchCard actions={actions} context={context} />
));

const PlantSearchCard: FC<ExtensionProps> = ({ actions, context }) => {
  const contactId = context.crm?.objectId;
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<PlantDetails | null>(null);

  const searchPlants = async (): Promise<void> => {
    if (!searchQuery.trim()) {
      setError("Please enter a plant name to search");
      return;
    }

    setLoading(true);
    setError(null);
    setPlants([]);

    try {
      // Call Perenual API using hubspot.fetch
      const apiKey = "sk-x9B469207829b086813596";
      const url = `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(searchQuery)}`;

      console.log("Fetching from URL:", url);

      const response = await hubspot.fetch(url);

      console.log("Response status:", response.status);
      console.log("Response OK:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);

        if (response.status === 429) {
          setError("Rate limit reached. Please wait a moment and try again. (Free tier: 100 requests/day)");
          setLoading(false);
          return;
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("API response data:", data);

      if (data.data && data.data.length > 0) {
        const plants = data.data.map((plant: any) => ({
          id: plant.id,
          common_name: plant.common_name,
          scientific_name: plant.scientific_name,
          thumbnail: plant.default_image?.thumbnail || null,
          watering: plant.watering || "Unknown",
          sunlight: plant.sunlight || []
        }));
        setPlants(plants);
      } else {
        setError("No plants found. Try a different search term.");
      }
    } catch (err) {
      setError("Failed to search plants. Please try again.");
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const viewPlantDetails = async (plantId: number): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = "sk-x9B469207829b086813596";
      const url = `https://perenual.com/api/v2/species/details/${plantId}?key=${apiKey}`;

      console.log("Fetching plant details from:", url);

      const response = await hubspot.fetch(url);

      console.log("Plant details response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Plant details error:", errorText);

        if (response.status === 429) {
          setError("Rate limit reached. Please wait a moment before viewing more plant details. (Free tier: 100 requests/day)");
          setLoading(false);
          return;
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      const plant = await response.json();
      console.log("Plant details:", plant);

      setSelectedPlant({
        id: plant.id,
        common_name: plant.common_name,
        scientific_name: plant.scientific_name?.[0] || plant.scientific_name,
        image: plant.default_image?.original_url || plant.default_image?.regular_url || null,
        watering: plant.watering,
        watering_period: plant.watering_period || "Not specified",
        sunlight: plant.sunlight || [],
        care_level: plant.care_level || "Unknown",
        description: plant.description || "No description available"
      });
    } catch (err) {
      setError("Failed to load plant details. Please try again.");
      console.error("Details error:", err);
    } finally {
      setLoading(false);
    }
  };

  const addPlantToContact = async (): Promise<void> => {
    if (!contactId) {
      setError("Unable to determine contact ID");
      return;
    }

    if (!selectedPlant) {
      setError("No plant selected");
      return;
    }

    // For now, just show the plant info
    // Creating custom objects requires serverless functions or external API
    actions.addAlert({
      type: "success",
      message: `Plant selected: ${selectedPlant.common_name}. Custom object creation requires additional setup.`
    });

    // Log plant details for now
    console.log("Would create plant for contact:", {
      contactId,
      plant: selectedPlant
    });
  };

  const backToSearch = (): void => {
    setSelectedPlant(null);
  };

  return (
    <Flex direction="column" gap="md">
      <Heading>Plant Care Assistant</Heading>

      {!selectedPlant ? (
        <>
          <Text>Search for plants using the Perenual plant database</Text>

          <Flex direction="row" gap="sm">
            <Input
              name="searchQuery"
              placeholder="Search for a plant (e.g., Monstera, Succulent)"
              value={searchQuery}
              onInput={(value: string) => setSearchQuery(value)}
              disabled={loading}
            />
            <Button
              onClick={searchPlants}
              disabled={loading || !searchQuery.trim()}
            >
              Search
            </Button>
          </Flex>

          {loading && (
            <Flex direction="row" justify="center">
              <LoadingSpinner />
            </Flex>
          )}

          {error && (
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          )}

          {plants.length > 0 && (
            <Flex direction="column" gap="sm">
              <Text format={{ fontWeight: "bold" }}>Search Results:</Text>
              {plants.map((plant) => (
                <Box key={plant.id}>
                  <Flex direction="row" gap="sm" align="center">
                    {plant.thumbnail && (
                      <Image
                        src={plant.thumbnail}
                        alt={plant.common_name}
                        width={60}
                        height={60}
                      />
                    )}
                    <Flex direction="column" gap="xs">
                      <Text format={{ fontWeight: "bold" }}>
                        {plant.common_name}
                      </Text>
                      <Text variant="microcopy">
                        {plant.scientific_name?.[0] || ""}
                      </Text>
                    </Flex>
                    <Button
                      variant="secondary"
                      onClick={() => viewPlantDetails(plant.id)}
                    >
                      View Details
                    </Button>
                  </Flex>
                  <Divider distance="sm" />
                </Box>
              ))}
            </Flex>
          )}
        </>
      ) : (
        <>
          <Flex direction="row" gap="sm" align="center">
            <Button variant="secondary" onClick={backToSearch}>
              ← Back to Search
            </Button>
          </Flex>

          <Divider />

          {selectedPlant.image && (
            <Image
              src={selectedPlant.image}
              alt={selectedPlant.common_name}
              width={200}
            />
          )}

          <Heading>{selectedPlant.common_name}</Heading>
          <Text variant="microcopy">{selectedPlant.scientific_name}</Text>

          <Divider />

          <Flex direction="column" gap="sm">
            <Text format={{ fontWeight: "bold" }}>Care Information:</Text>

            {selectedPlant.watering && (
              <Text>💧 Watering: {selectedPlant.watering}</Text>
            )}

            {selectedPlant.sunlight && (
              <Text>☀️ Sunlight: {selectedPlant.sunlight.join(", ")}</Text>
            )}

            {selectedPlant.care_level && (
              <Text>🌱 Care Level: {selectedPlant.care_level}</Text>
            )}

            {selectedPlant.description && (
              <>
                <Divider distance="sm" />
                <Text format={{ fontWeight: "bold" }}>Description:</Text>
                <Text>{selectedPlant.description}</Text>
              </>
            )}
          </Flex>

          <Divider />

          <Button onClick={addPlantToContact}>
            Add Plant to Contact
          </Button>
        </>
      )}
    </Flex>
  );
};
