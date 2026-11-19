import { vi } from "vitest";
import { platformCatalog } from "@/registry/platformCatalog";
import { expandSwitches, youthRepublicCatalog } from "@/registry/moduleCatalog";

export const yrCatalogFixture = {
  ...youthRepublicCatalog,
  roleTemplates: [
    {
      name: "Chapter Lead",
      description: "Full Youth Republic access for the assigned chapters.",
      place: "chapters" as const,
      switches: {
        drives: "manage",
        noticeboard: "manage",
        applications: "manage",
        hours: "manage",
        volunteers: "none",
      },
    },
  ],
};

export const moduleCatalogsFixture = [platformCatalog, yrCatalogFixture];

export const chapterLeadPermissionKeys = [
  ...expandSwitches(yrCatalogFixture, yrCatalogFixture.roleTemplates[0].switches),
  "chapters:read",
  "chapters:write",
].sort();

export function mockModuleCatalogsFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/module-catalogs")) {
      return new Response(JSON.stringify({ catalogs: moduleCatalogsFixture }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}