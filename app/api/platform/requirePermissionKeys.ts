export function requirePermissionKeys(body: { permissionKeys?: unknown }): string[] {
  if (!Array.isArray(body.permissionKeys) || body.permissionKeys.some((key) => typeof key !== "string")) {
    throw new Error("permission_keys_required");
  }
  return body.permissionKeys as string[];
}