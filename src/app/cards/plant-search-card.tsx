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

interface WateringBenchmark {
  value: string;
  unit: string;
}

interface Plant {
  id: number;
  common_name: string;
  scientific_name?: string[];
  thumbnail?: string;
  watering?: string;
  watering_general_benchmark?: WateringBenchmark;
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

interface AssociatedPlant {
  id: string;
  plantName: string;
  scientificName?: string;
  wateringFrequency?: string;
  wateringPeriod?: string;
  sunlightRequirement?: string;
  careLevel?: string;
  imageUrl?: string;
  nextWateringDate?: string;
  perenualPlantId?: string;
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
  const [associatedPlants, setAssociatedPlants] = useState<AssociatedPlant[]>([]);
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [editingPlant, setEditingPlant] = useState<AssociatedPlant | null>(null);
  const [customWateringDays, setCustomWateringDays] = useState<string>("");

  // Fetch associated plants on load
  React.useEffect(() => {
    if (contactId) {
      fetchAssociatedPlants();
    }
  }, [contactId]);

  const fetchAssociatedPlants = async (): Promise<void> => {
    if (!contactId) return;

    setLoading(true);
    try {
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/contact/${contactId}`;

      const response = await hubspot.fetch(url);

      if (!response.ok) {
        console.error("Failed to fetch associated plants:", response.status);
        return;
      }

      const data = await response.json();
      setAssociatedPlants(data.plants || []);
    } catch (err) {
      console.error("Error fetching associated plants:", err);
    } finally {
      setLoading(false);
    }
  };

  const searchPlants = async (): Promise<void> => {
    if (!searchQuery.trim()) {
      setError("Please enter a plant name to search");
      return;
    }

    setLoading(true);
    setError(null);
    setPlants([]);

    try {
      // Call backend API using hubspot.fetch
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/search?q=${encodeURIComponent(searchQuery)}&indoor=1`;

      console.log("Fetching from backend URL:", url);

      const response = await hubspot.fetch(url);

      console.log("Response status:", response.status);
      console.log("Response OK:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Backend API error:", errorText);

        if (response.status === 429) {
          setError("Rate limit reached. Please wait a moment and try again.");
          setLoading(false);
          return;
        }

        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("Backend response data:", data);

      if (data.data && data.data.length > 0) {
        setPlants(data.data);
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
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/${plantId}`;

      console.log("Fetching plant details from backend:", url);

      const response = await hubspot.fetch(url);

      console.log("Plant details response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Plant details error:", errorText);

        if (response.status === 429) {
          setError("Rate limit reached. Please wait a moment before viewing more plant details.");
          setLoading(false);
          return;
        }

        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }

      const plant = await response.json();
      console.log("Plant details (with fresh watering data):", plant);

      setSelectedPlant({
        id: plant.id,
        common_name: plant.common_name,
        scientific_name: plant.scientific_name,
        image: plant.image,
        watering: plant.watering,
        watering_period: plant.watering_period,
        watering_general_benchmark: plant.watering_general_benchmark,
        sunlight: plant.sunlight || [],
        care_level: plant.care_level,
        description: plant.description
      });
    } catch (err) {
      setError("Failed to load plant details. Please try again.");
      console.error("Details error:", err);
    } finally {
      setLoading(false);
    }
  };

  const extractWateringDays = (
    wateringPeriod?: string,
    wateringBenchmark?: WateringBenchmark
  ): number | undefined => {
    // First, try to use watering_general_benchmark if available
    if (wateringBenchmark && wateringBenchmark.value && wateringBenchmark.unit) {
      const value = wateringBenchmark.value;
      const unit = wateringBenchmark.unit.toLowerCase();

      // Handle range values like "5-7" by taking the average
      let numericValue: number;
      if (value.includes('-')) {
        const [min, max] = value.split('-').map(v => parseInt(v.trim(), 10));
        numericValue = Math.round((min + max) / 2);
      } else {
        numericValue = parseInt(value, 10);
      }

      if (isNaN(numericValue)) return undefined;

      // Convert to days based on unit
      if (unit.includes('day')) {
        return numericValue;
      } else if (unit.includes('week')) {
        return numericValue * 7;
      } else if (unit.includes('month')) {
        return numericValue * 30;
      } else if (unit.includes('year')) {
        return numericValue * 365;
      }

      return numericValue;
    }

    // Fall back to parsing wateringPeriod string
    if (!wateringPeriod || wateringPeriod === 'Not specified') return undefined;

    const lowerPeriod = wateringPeriod.toLowerCase();

    // Extract the number from the string
    const match = lowerPeriod.match(/(\d+)/);
    if (!match) return undefined;

    const value = parseInt(match[1], 10);

    // Convert to days based on time unit
    if (lowerPeriod.includes('day')) {
      return value;
    } else if (lowerPeriod.includes('week')) {
      return value * 7;
    } else if (lowerPeriod.includes('month')) {
      return value * 30;
    } else if (lowerPeriod.includes('year')) {
      return value * 365;
    }

    // Default to days if no unit specified
    return value;
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

    setLoading(true);
    setError(null);

    try {
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/associate`;

      console.log("Creating plant association for contact:", contactId);

      const wateringDays = extractWateringDays(
        selectedPlant.watering_period,
        selectedPlant.watering_general_benchmark
      );

      const today = new Date().toISOString().split('T')[0];

      const response = await hubspot.fetch(url, {
        method: "POST",
        body: JSON.stringify({
          contactId,
          plantId: selectedPlant.id,
          commonName: selectedPlant.common_name,
          scientificName: selectedPlant.scientific_name,
          watering: selectedPlant.watering,
          wateringPeriod: selectedPlant.watering_period,
          wateringDays: wateringDays,
          nextWateringDate: today,
          sunlight: selectedPlant.sunlight,
          careLevel: selectedPlant.care_level,
          imageUrl: selectedPlant.image,
          description: selectedPlant.description
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Plant association error:", errorText);
        throw new Error(`Failed to create plant association: ${response.status}`);
      }

      const result = await response.json();
      console.log("Plant association result:", result);

      actions.addAlert({
        type: "success",
        message: `Successfully added ${selectedPlant.common_name} to this contact!`
      });

      // Refresh associated plants list
      await fetchAssociatedPlants();

      // Go back to main view after successful addition
      setSelectedPlant(null);
      setPlants([]);
      setSearchQuery("");
      setShowSearch(false);
    } catch (err) {
      setError("Failed to add plant to contact. Please try again.");
      console.error("Add plant error:", err);
    } finally {
      setLoading(false);
    }
  };

  const backToSearch = (): void => {
    setSelectedPlant(null);
  };

  const removePlantFromContact = async (plantId: string): Promise<void> => {
    if (!contactId) return;

    setLoading(true);
    setError(null);

    try {
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/contact/${contactId}/plant/${plantId}`;

      const response = await hubspot.fetch(url, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(`Failed to remove plant: ${response.status}`);
      }

      actions.addAlert({
        type: "success",
        message: "Plant removed successfully!"
      });

      // Refresh the list
      await fetchAssociatedPlants();
    } catch (err) {
      setError("Failed to remove plant. Please try again.");
      console.error("Remove plant error:", err);
    } finally {
      setLoading(false);
    }
  };

  const isPlantAlreadyAdded = (plantId: number): boolean => {
    return associatedPlants.some(
      (p: AssociatedPlant) => p.perenualPlantId === plantId.toString()
    );
  };

  const viewAssociatedPlant = (plant: AssociatedPlant): void => {
    setEditingPlant(plant);
    // Pre-fill the watering days if available
    if (plant.wateringPeriod) {
      const match = plant.wateringPeriod.match(/(\d+)/);
      if (match) {
        setCustomWateringDays(match[1]);
      }
    }
  };

  const updatePlantWateringPeriod = async (): Promise<void> => {
    if (!editingPlant || !contactId) return;

    const days = parseInt(customWateringDays, 10);
    if (isNaN(days) || days <= 0) {
      setError("Please enter a valid number of days");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const backendUrl = "https://plants-production-a263.up.railway.app";
      const url = `${backendUrl}/api/plants/contact/${contactId}/plant/${editingPlant.id}`;

      const response = await hubspot.fetch(url, {
        method: "PATCH",
        body: JSON.stringify({
          wateringPeriod: `Every ${days} days`,
          wateringDays: days
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update watering period: ${response.status}`);
      }

      actions.addAlert({
        type: "success",
        message: "Watering period updated successfully!"
      });

      // Refresh the list
      await fetchAssociatedPlants();

      // Close edit view
      setEditingPlant(null);
      setCustomWateringDays("");
    } catch (err) {
      setError("Failed to update watering period. Please try again.");
      console.error("Update watering period error:", err);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = (): void => {
    setEditingPlant(null);
    setCustomWateringDays("");
    setError(null);
  };

  return (
    <Flex direction="column" gap="md">
      <Heading>Plant Care Assistant</Heading>

      {editingPlant ? (
        <>
          <Flex direction="row" gap="sm" align="center">
            <Button variant="secondary" onClick={cancelEdit}>
              ← Back
            </Button>
            <Text format={{ fontWeight: "bold" }}>Edit Plant</Text>
          </Flex>

          <Divider />

          {editingPlant.imageUrl && (
            <Image
              src={editingPlant.imageUrl}
              alt={editingPlant.plantName}
              width={200}
            />
          )}

          <Heading>{editingPlant.plantName}</Heading>
          {editingPlant.scientificName && (
            <Text variant="microcopy">{editingPlant.scientificName}</Text>
          )}

          <Divider />

          <Flex direction="column" gap="sm">
            <Text format={{ fontWeight: "bold" }}>Care Information:</Text>

            {editingPlant.wateringFrequency && (
              <Text>💧 Watering: {editingPlant.wateringFrequency}</Text>
            )}

            {editingPlant.wateringPeriod && editingPlant.wateringPeriod !== 'Not specified' && (
              <Text>⏱️ Current watering period: {editingPlant.wateringPeriod}</Text>
            )}

            {editingPlant.sunlightRequirement && (
              <Text>☀️ Sunlight: {editingPlant.sunlightRequirement}</Text>
            )}

            {editingPlant.careLevel && (
              <Text>🌱 Care Level: {editingPlant.careLevel}</Text>
            )}
          </Flex>

          <Divider />

          <Text format={{ fontWeight: "bold" }}>Update Watering Period:</Text>
          <Flex direction="row" gap="sm" align="center">
            <Text>Water every</Text>
            <Input
              name="wateringDays"
              placeholder="7"
              value={customWateringDays}
              onInput={(value: string) => setCustomWateringDays(value)}
              disabled={loading}
            />
            <Text>days</Text>
          </Flex>

          {error && (
            <Alert variant="error" title="Error">
              {error}
            </Alert>
          )}

          <Button onClick={updatePlantWateringPeriod} disabled={loading || !customWateringDays.trim()}>
            {loading ? "Updating..." : "Update Watering Period"}
          </Button>
        </>
      ) : !selectedPlant && !showSearch ? (
        <>
          <Text>Manage plants for this contact</Text>

          {loading && (
            <Flex direction="row" justify="center">
              <LoadingSpinner />
            </Flex>
          )}

          {associatedPlants.length > 0 ? (
            <Flex direction="column" gap="sm">
              <Text format={{ fontWeight: "bold" }}>Associated Plants:</Text>
              {associatedPlants.map((plant: AssociatedPlant) => (
                <Box key={plant.id}>
                  <Flex direction="row" gap="sm" align="start">
                    {plant.imageUrl && (
                      <Image
                        src={plant.imageUrl}
                        alt={plant.plantName}
                        width={80}
                        height={80}
                      />
                    )}
                    <Flex direction="column" gap="xs" flex={1}>
                      <Text format={{ fontWeight: "bold" }}>
                        {plant.plantName}
                      </Text>
                      {plant.scientificName && (
                        <Text variant="microcopy">{plant.scientificName}</Text>
                      )}
                      {plant.wateringFrequency && (
                        <Text>💧 {plant.wateringFrequency}</Text>
                      )}
                      {plant.wateringPeriod && plant.wateringPeriod !== 'Not specified' && (
                        <Text>⏱️ Watering period: {plant.wateringPeriod}</Text>
                      )}
                      {plant.careLevel && (
                        <Text>🌱 Care level: {plant.careLevel}</Text>
                      )}
                    </Flex>
                    <Flex direction="column" gap="xs">
                      <Button
                        variant="secondary"
                        onClick={() => viewAssociatedPlant(plant)}
                        disabled={loading}
                      >
                        View/Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => removePlantFromContact(plant.id)}
                        disabled={loading}
                      >
                        Remove
                      </Button>
                    </Flex>
                  </Flex>
                  <Divider distance="sm" />
                </Box>
              ))}
            </Flex>
          ) : (
            !loading && <Text>No plants associated with this contact yet.</Text>
          )}

          <Button onClick={() => setShowSearch(true)}>
            Add New Plant
          </Button>
        </>
      ) : !selectedPlant ? (
        <>
          <Flex direction="row" gap="sm" align="center">
            <Button variant="secondary" onClick={() => {
              setShowSearch(false);
              setPlants([]);
              setSearchQuery("");
              setError(null);
            }}>
              ← Back
            </Button>
            <Text format={{ fontWeight: "bold" }}>Search for plants</Text>
          </Flex>

          <Divider />

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
              {plants.map((plant: Plant) => (
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
                    <Flex direction="column" gap="xs" flex={1}>
                      <Flex direction="row" gap="xs" align="center">
                        <Text format={{ fontWeight: "bold" }}>
                          {plant.common_name}
                        </Text>
                        {isPlantAlreadyAdded(plant.id) && (
                          <Text variant="microcopy" format={{ fontWeight: "bold" }}>
                            ✓ Already Added
                          </Text>
                        )}
                      </Flex>
                      <Text variant="microcopy">
                        {plant.scientific_name?.[0] || ""}
                      </Text>
                    </Flex>
                    <Button
                      variant="secondary"
                      onClick={() => viewPlantDetails(plant.id)}
                      disabled={isPlantAlreadyAdded(plant.id)}
                    >
                      {isPlantAlreadyAdded(plant.id) ? "Already Added" : "View Details"}
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

            {selectedPlant.watering_period && selectedPlant.watering_period !== 'Not specified' && (
              <Text>⏱️ Watering period: {selectedPlant.watering_period}</Text>
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
