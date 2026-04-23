import type { ConvexHttpClient } from "convex/browser";

import type { LocalizaAcquisitionStrategy } from "@casedra/types";

import { resolveIdealistaLocation } from "./resolver";

export const createLocalizaService = (deps: { convex: ConvexHttpClient }) => ({
  async resolveIdealistaLocation(input: {
    url: string;
    strategy: LocalizaAcquisitionStrategy;
  }) {
    return await resolveIdealistaLocation({
      convex: deps.convex,
      url: input.url,
      strategy: input.strategy,
    });
  },
});
