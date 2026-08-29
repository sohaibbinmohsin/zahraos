export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export function OrganizationsList({ organizations }: { organizations: OrganizationSummary[] }) {
  return (
    <ul className="divide-y divide-gray-200">
      {organizations.map((org) => (
        <li key={org.id} className="flex items-center justify-between py-3">
          <div>
            <p className="font-medium">{org.name}</p>
            <p className="text-sm text-gray-500">{org.slug}</p>
          </div>
          <span className="text-sm text-gray-600">{org.status}</span>
        </li>
      ))}
    </ul>
  );
}
