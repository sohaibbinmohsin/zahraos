async function callFunction<TResponse>(
  name: string,
  body: unknown,
  accessToken: string,
): Promise<TResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_FUNCTIONS_URL is not set");
  }

  const response = await fetch(`${baseUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? "request_failed");
  }
  return data as TResponse;
}

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  organizationId: string;
}
export interface CreateStaffResponse {
  staffId: string;
  temporaryPassword: string;
}
export function createStaff(payload: CreateStaffPayload, accessToken: string) {
  return callFunction<CreateStaffResponse>("create-staff", payload, accessToken);
}

export interface SetPasswordPayload {
  newPassword: string;
}
export interface SetPasswordResponse {
  staffId: string;
}
export function setPassword(payload: SetPasswordPayload, accessToken: string) {
  return callFunction<SetPasswordResponse>("set-password", payload, accessToken);
}

export interface CreateOrganizationPayload {
  name: string;
  slug: string;
}
export interface CreateOrganizationResponse {
  organizationId: string;
}
export function createOrganization(payload: CreateOrganizationPayload, accessToken: string) {
  return callFunction<CreateOrganizationResponse>("create-organization", payload, accessToken);
}

export interface UpdateOrganizationPayload {
  organizationId: string;
  name: string;
}
export interface UpdateOrganizationResponse {
  enabledModuleKeys: string[];
}
export function updateOrganization(payload: UpdateOrganizationPayload, accessToken: string) {
  return callFunction<UpdateOrganizationResponse>("update-organization", payload, accessToken);
}

export interface EnableModulePayload {
  organizationId: string;
  moduleKey: string;
}
export interface EnableModuleResponse {
  moduleKey: string;
}
export function enableModule(payload: EnableModulePayload, accessToken: string) {
  return callFunction<EnableModuleResponse>("enable-module", payload, accessToken);
}

export interface AssignStaffModuleRolePayload {
  staffId: string;
  organizationId: string;
  moduleId: string;
  roleId: string;
}
export interface AssignStaffModuleRoleResponse {
  staffId: string;
}
export function assignStaffModuleRole(payload: AssignStaffModuleRolePayload, accessToken: string) {
  return callFunction<AssignStaffModuleRoleResponse>("assign-staff-module-role", payload, accessToken);
}

export interface CreateCustomRolePayload {
  organizationId: string;
  moduleId: string;
  name: string;
  permissionIds: string[];
}
export interface CreateCustomRoleResponse {
  roleId: string;
}
export function createCustomRole(payload: CreateCustomRolePayload, accessToken: string) {
  return callFunction<CreateCustomRoleResponse>("create-custom-role", payload, accessToken);
}

export interface DeactivateStaffPayload {
  targetStaffId: string;
}
export interface DeactivateStaffResponse {
  staffId: string;
}
export function deactivateStaff(payload: DeactivateStaffPayload, accessToken: string) {
  return callFunction<DeactivateStaffResponse>("deactivate-staff", payload, accessToken);
}
