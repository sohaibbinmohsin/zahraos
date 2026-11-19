export interface ModuleRegistryEntry {
  key: string;
  navLabel: string;
  route: string;
  icon: string;
  functionsEnv?: string;
}

export const MODULE_REGISTRY: ModuleRegistryEntry[] = [
  {
    key: "youth-republic",
    navLabel: "Youth Republic",
    route: "/youth-republic",
    icon: "🤝",
    functionsEnv: "YOUTH_REPUBLIC_BACKEND_FUNCTIONS_URL",
  },
];
