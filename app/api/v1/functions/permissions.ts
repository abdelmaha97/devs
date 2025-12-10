import { dbConnection } from './db';
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
const secret = process.env.NEXTAUTH_SECRET;

type UserContext = {
  id: number | string;
  role_id?: number | null;
  roleId?: number | null;
  tenant_id?: number | string | null;
  tenantId?: number | string | null;
};



/**
 * Checks if a user has a specific permission through their assigned role.
 * 
 * Validation includes:
 *   1) Fetching the user's role
 *   2) Matching the role's permissions (via role_permissions table)
 * 
 * Supports tenant-level isolation.
 * 
 * @param {Object} user - The user object containing user.id and role_id.
 * @param {string} permissionCode - The permission code to verify.
 * @returns {Promise<boolean>} True if the user has the required permission.
 */

export async function hasPermission(
  user: UserContext | null,
  permissionCode: string
): Promise<boolean> {
  if (!user || !user.id || !permissionCode) return false;

  const pool = await dbConnection();

  let roleId = user.role_id ?? user.roleId ?? null;
  let roleSlug: string | null = null;

  if (!roleId) {
    const [roleRows]: any = await pool.query(
      `SELECT u.role_id, r.slug FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ? LIMIT 1`,
      [user.id]
    );
    if (Array.isArray(roleRows) && roleRows.length > 0) {
      roleId = roleRows[0].role_id;
      roleSlug = roleRows[0].slug ?? null;
    }
  }

  if (!roleSlug && roleId) {
    const [slugRows]: any = await pool.query(
      `SELECT slug FROM roles WHERE id = ? LIMIT 1`,
      [roleId]
    );
    if (Array.isArray(slugRows) && slugRows.length > 0) {
      roleSlug = slugRows[0].slug ?? null;
    }
  }

  if (roleSlug === 'super_admin') return true;

  if (!roleId) return false;

  const [rows]: any = await pool.query(
    `SELECT rp.id
     FROM role_permissions rp
     INNER JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ? AND p.code = ?
     LIMIT 1`,
    [roleId, permissionCode]
  );

  return Array.isArray(rows) && rows.length > 0;
}



export async function getUserData(req: NextRequest) {
    const token = await getToken({ req, secret });
    return token || null;
}


/**
 * Checks whether the user has access to the requested tenant.
 * 
 * Validation includes:
 *   1) Direct user-to-tenant assignment (users.tenant_id)
 *   2) Role tenant assignment (roles.tenant_id)
 * 
 * @param {Object} user - The user object (contains user.id and role_id).
 * @param {number|string|null} tenant_id - The tenant/company ID to validate.
 * @returns {Promise<boolean>} True if the user has access, otherwise false.
 */

export async function hasTenantAccess(
  user: UserContext | null,
  tenant_id: number | string | null
): Promise<boolean> {
  if (!user || !user.id || !tenant_id) return false;

  const normalizedTenant = String(tenant_id);
  const cachedTenant = user.tenant_id ?? user.tenantId;
  if (cachedTenant && String(cachedTenant) === normalizedTenant) {
    return true;
  }

  const pool = await dbConnection();

  // 1) direct tenant assignment with status enforcement
  const [userTenant]: any = await pool.query(
    `SELECT id 
     FROM users 
     WHERE id = ? AND tenant_id = ? AND status = 'active'
     LIMIT 1`,
    [user.id, tenant_id]
  );

  if (Array.isArray(userTenant) && userTenant.length > 0) {
    return true;
  }

  // 2) tenant via role assignment
  const [roleTenant]: any = await pool.query(
    `SELECT r.id 
     FROM users u
     INNER JOIN roles r ON u.role_id = r.id
     WHERE u.id = ? AND r.tenant_id = ? AND u.status = 'active'
     LIMIT 1`,
    [user.id, tenant_id]
  );

  return Array.isArray(roleTenant) && roleTenant.length > 0;
}
