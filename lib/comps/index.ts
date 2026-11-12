import { demoCompsProvider } from "./demo-provider";
import { landPortalCompsProvider } from "./land-portal";
import type { CompProviderId, CompQuery, CompFetchResult } from "../types";

export interface CompsProvider {
  id: CompProviderId;
  label: string;
  fetch(query: CompQuery): Promise<CompFetchResult>;
}

export function getProvider(id: CompProviderId): CompsProvider {
  if (id === "land_portal") return landPortalCompsProvider;
  return demoCompsProvider;
}
