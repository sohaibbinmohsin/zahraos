import type { ModuleCatalog, PlaceParameter } from "@/registry/moduleCatalog";
import { platformCatalog } from "@/registry/platformCatalog";

export function buildRolePlaceIndex(catalogs: ModuleCatalog[]): Map<string, PlaceParameter> {
  const map = new Map<string, PlaceParameter>();
  for (const catalog of catalogs) {
    for (const template of catalog.roleTemplates) {
      map.set(template.name, template.place);
    }
  }
  return map;
}

export function rolesWithTemplatePlace(
  roles: { id: string; name: string; isSystem: boolean; permissionKeys?: string[] }[],
  catalogs: ModuleCatalog[] | null,
): { id: string; name: string; isSystem: boolean; permissionKeys?: string[]; place?: PlaceParameter }[] {
  const catalogsForIndex = catalogs?.length ? catalogs : [platformCatalog];
  const placeByName = buildRolePlaceIndex(catalogsForIndex);
  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    isSystem: r.isSystem,
    permissionKeys: r.permissionKeys,
    place: placeByName.get(r.name),
  }));
}