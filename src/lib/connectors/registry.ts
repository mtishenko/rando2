import type { Capability } from "@/lib/types";
import type { Connector } from "@/lib/connectors/types";
import { NinjaOneConnector } from "@/lib/connectors/ninjaone";
import { MicrosoftGraphConnector } from "@/lib/connectors/microsoftGraph";
import { MSP360Connector } from "@/lib/connectors/msp360";
import { CrowdStrikeConnector } from "@/lib/connectors/crowdstrike";

/**
 * Connector registry. New vendors register here; the rest of the platform selects
 * by capability, never by vendor (product principle: capability-based architecture).
 */
export const CONNECTORS: Connector[] = [
  new NinjaOneConnector(),
  new MicrosoftGraphConnector(),
  new MSP360Connector(),
  new CrowdStrikeConnector(),
];

export function connectorBySource(source: string): Connector | undefined {
  return CONNECTORS.find((c) => c.source === source);
}

export function connectorsForCapability(capability: Capability): Connector[] {
  return CONNECTORS.filter((c) => c.capability === capability);
}
