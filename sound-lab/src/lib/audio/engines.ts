import type { EngineBuilder } from "./core";
import { perceptionEngines } from "./engines-perception";
import { synthesisEngines } from "./engines-synthesis";

export const engines: Record<string, EngineBuilder> = {
  ...perceptionEngines,
  ...synthesisEngines,
};

export function getEngine(slug: string): EngineBuilder | undefined {
  return engines[slug];
}
