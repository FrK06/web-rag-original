// src/components/auth/roles.ts
export type UserRole = 'user' | 'admin' | 'manager';

export interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  user: [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
  ],
  manager: [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
    { resource: 'users', action: 'read' },
  ],
  admin: [
    { resource: 'profile', action: 'read' },
    { resource: 'profile', action: 'update' },
    { resource: 'users', action: 'read' },
    { resource: 'users', action: 'create' },
    { resource: 'users', action: 'update' },
    { resource: 'users', action: 'delete' },
    { resource: 'settings', action: 'manage' },
  ],
};

export function hasPermission(
  userRole: UserRole,
  resource: string,
  action: Permission['action']
): boolean {
  const permissions = ROLE_PERMISSIONS[userRole];
  return permissions.some(
    p => p.resource === resource && (p.action === action || p.action === 'manage')
  );
}