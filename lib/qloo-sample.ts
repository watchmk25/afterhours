import type { QlooInterest } from "./qloo-types.ts";

// Reviewed title/type/author evidence: docs/qloo-feasibility-resolutions.json.
// These provider IDs are separate from the catalogue's stable local identities.
export const SAMPLE_QLOO_MAPPINGS: Readonly<Record<string, string>> = {
  "the-namesake": "CE8065B9-1496-4B0D-B5A6-5D486C867A98",
  "the-guide": "DF4272D0-A6BA-445B-88DC-172A56B5D183",
  "the-palace-of-illusions": "E0FF55E0-1522-4438-A8FB-ADF0D62F7B5B",
  "malgudi-days": "5FE81158-6890-42CB-9F60-439C14174DB4",
  "the-god-of-small-things": "F74BAA1D-6C16-4EED-9BD7-304FB321A0A2",
};

export const QLOO_PRESETS: readonly {
  id: "a" | "b";
  label: string;
  interests: readonly QlooInterest[];
}[] = [
  {
    id: "a", label: "Example A: Amélie + Norah Jones",
    interests: [
      { entityId: "B7A0731F-EC92-496A-9C40-47D9770489B6", name: "Amélie", kind: "movie", disambiguation: "2001", reference: { preset: "a", index: 0 } },
      { entityId: "CFB97CDA-1B2D-4F1A-B707-415E76AFC016", name: "Norah Jones", kind: "artist", reference: { preset: "a", index: 1 } },
    ],
  },
  {
    id: "b", label: "Example B: Interstellar + Hans Zimmer",
    interests: [
      { entityId: "057DA9D9-399B-437E-8BCA-A80E499125EF", name: "Interstellar", kind: "movie", disambiguation: "2014", reference: { preset: "b", index: 0 } },
      { entityId: "37DB91E9-9EE1-4C98-AA01-0AF0C34274EC", name: "Hans Zimmer", kind: "artist", reference: { preset: "b", index: 1 } },
    ],
  },
];
