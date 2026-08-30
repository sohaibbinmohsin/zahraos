export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  { key: "youth-republic", navLabel: "Youth Republic", route: "/modules/youth-republic", icon: "🤝" },
];
