import type { Enums } from "@duckmate/db";

/** ReconsentGate props 항목 (getPendingReconsents 결과) */
export type PendingReconsent = {
  documentKey: Enums["legal_doc_key"];
  version: string;
  label: string;
  href: string;
};
