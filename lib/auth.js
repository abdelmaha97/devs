export function hasRole(user, role) {
  if (!user || !user.roles) return false;
  return user.roles.includes(role);
}

export function hasPermission(user, permission) {
  if (!user || !user.roles) return false;
  if (user.roles.includes('super_admin')) return true;
  if (!user.permissions) return false;
  return user.permissions.includes(permission);
}

export function isSuperAdmin(user) {
  return user && Array.isArray(user.roles) && user.roles.includes('super_admin');
}