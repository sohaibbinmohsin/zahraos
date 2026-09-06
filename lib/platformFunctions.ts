import type { CapabilityGrid } from "./capabilityMap";

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

export interface AssignStaffOrgRolePayload {
  staffId: string;
  organizationId: string;
  orgTier: "admin" | "super_admin";
}
export interface AssignStaffOrgRoleResponse {
  staffId: string;
}
export function assignStaffOrgRole(payload: AssignStaffOrgRolePayload, accessToken: string) {
  return callFunction<AssignStaffOrgRoleResponse>("assign-staff-org-role", payload, accessToken);
}

export interface RoleAssignmentPayload {
  roleId: string;
  scopeKind: "org_wide" | "chapter";
  chapterId?: string | null;
  scopeLabel: string;
}

export interface InviteStaffMemberPayload {
  organizationId: string;
  fullName: string;
  email: string;
  phone?: string;
  roles: RoleAssignmentPayload[];
  sendActivationEmail: boolean;
  enforce2fa: boolean;
}
export interface InviteStaffMemberResponse { staffId: string; invitationId: string }
export function inviteStaffMember(payload: InviteStaffMemberPayload, accessToken: string) {
  return callFunction<InviteStaffMemberResponse>("invite-staff-member", payload, accessToken);
}

export interface UpdateStaffAccessPayload {
  staffId: string;
  organizationId: string;
  roles: RoleAssignmentPayload[];
  status: "active" | "invited" | "deactivated";
}
export interface UpdateStaffAccessResponse { staffId: string }
export function updateStaffAccess(payload: UpdateStaffAccessPayload, accessToken: string) {
  return callFunction<UpdateStaffAccessResponse>("update-staff-access", payload, accessToken);
}

export interface RemoveStaffMemberPayload { staffId: string; organizationId: string }
export interface RemoveStaffMemberResponse { staffId: string }
export function removeStaffMember(payload: RemoveStaffMemberPayload, accessToken: string) {
  return callFunction<RemoveStaffMemberResponse>("remove-staff-member", payload, accessToken);
}

export interface CreateCustomRolePayload {
  organizationId: string;
  moduleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}
export interface CreateCustomRoleResponse { roleId: string }
export function createCustomRole(payload: CreateCustomRolePayload, accessToken: string) {
  return callFunction<CreateCustomRoleResponse>("create-custom-role", payload, accessToken);
}

export interface UpdateCustomRolePayload {
  roleId: string;
  name: string;
  description: string;
  capabilities: CapabilityGrid;
}
export interface UpdateCustomRoleResponse { roleId: string }
export function updateCustomRole(payload: UpdateCustomRolePayload, accessToken: string) {
  return callFunction<UpdateCustomRoleResponse>("update-custom-role", payload, accessToken);
}

export interface DeleteCustomRolePayload { roleId: string }
export interface DeleteCustomRoleResponse { roleId: string }
export function deleteCustomRole(payload: DeleteCustomRolePayload, accessToken: string) {
  return callFunction<DeleteCustomRoleResponse>("delete-custom-role", payload, accessToken);
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
