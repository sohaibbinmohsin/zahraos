import type { ModuleCatalog } from "./moduleCatalog";
import { platformCatalog } from "./platformCatalog";
import { MODULE_REGISTRY } from "./modules";

export async function loadEnabledCatalogs(
  enabledModuleKeys: string[],
  fetchCatalog: (key: string) => Promise<ModuleCatalog>,
): Promise<ModuleCatalog[]> {
  const enabled = new Set(enabledModuleKeys);
  const catalogs: ModuleCatalog[] = [platformCatalog];

  for (const entry of MODULE_REGISTRY) {
    if (!enabled.has(entry.key)) {
      continue;
    }
    catalogs.push(await fetchCatalog(entry.key));
  }

  return catalogs;
}