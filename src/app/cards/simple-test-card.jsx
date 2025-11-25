import React from "react";
import { Text, Heading } from "@hubspot/ui-extensions";
import { hubspot } from "@hubspot/ui-extensions";

hubspot.extend(() => <SimpleTestCard />);

const SimpleTestCard = () => {
  return (
    <>
      <Heading>Simple Test Card</Heading>
      <Text>If you can see this, your card setup is working!</Text>
    </>
  );
};
