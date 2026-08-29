export interface RoleSummary {
  id: string;
  name: string;
  isSystem: boolean;
  moduleKey: string;
}

export function RolesList({ roles }: { roles: RoleSummary[] }) {
  return (
    <ul className="divide-y divide-gray-200">
      {roles.map((role) => (
        <li key={role.id} className="flex items-center justify-between py-2">
          <span>{role.name} <span className="text-sm text-gray-500">({role.moduleKey})</span></span>
          <span className="text-sm text-gray-600">{role.isSystem ? "System" : "Custom"}</span>
        </li>
      ))}
    </ul>
  );
}
