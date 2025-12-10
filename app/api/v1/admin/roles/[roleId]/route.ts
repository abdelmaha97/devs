import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

// Example error messages in English and Arabic
const errorMessages = {
  en: {
    serverError: "Internal server error.",
    unauthorized: "Unauthorized access.",
    roleExists: "Role with this name  already exists.",
    updatedSuccess: "Role updated successfully.",
    roleNotFound: "Role Not Found",
    missingTenantId: "tenant_id is required.",
    missingRoleId: "Role ID is missing",
    deletedSuccess: "The role deleted successfully.",

  },
  ar: {
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    roleExists: "الدور موجود بالفعل باسم مشابه.",
    updatedSuccess: "تم تحديث بيانات الدور بنجاح.",
    roleNotFound: "الدور غير موجود",
    missingRoleId: "معرّف الدور مفقود",
    missingTenantId: "معرف المنظمة مطلوب.",
    deletedSuccess: "تم حذف الدور بنجاح.",


  },
};
// Helper to get error message by language
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

// Required field labels
const requiredFieldLabels = {
  name: { en: "Role Name", ar: "اسم الدور" },
  name_ar: { en: "Role Name (Arabic)", ar: "اسم الدور بالعربي" },
  description: { en: "Description", ar: "الوصف" },
   slug:{ en: "slug", ar: "السلاج" },
  tenant_id: { en: "Tenant", ar: "الشركة" },
  permissions: { en: "Permissions", ar: "الصلاحيات" },
};
/**
 * PUT /api/v1/admin/roles/[roleId]
 *
 * Updates a specific role and its associated permissions for a given tenant.
 * The request payload is validated, tenant access is checked, and name conflicts are handled.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Path Parameters:
 *   - roleId (number, required)         : ID of the role to update
 *
 * Request Body:
 *   - tenant_id (number, required)      : Tenant ID the role belongs to
 *   - name (string, required)           : Role name (3–100 characters)
 *   - name_ar (string, optional)        : Arabic role name (3–100 characters)
 *   - description (string, optional)    : Role description (maximum 255 characters)
 *   - permissions (number[], required)  : Array of permission IDs to assign to the role
 *
 * Responses:
 *   - 200: { message }                  : Role updated successfully
 *   - 400: { error }                    : Validation failed or missing/invalid payload
 *   - 401: { error }                    : Unauthorized (missing permissions or tenant access)
 *   - 404: { error }                    : Role not found
 *   - 409: { error }                    : Role name already exists within the same tenant
 *   - 500: { error }                    : Internal server error
 *
 * Notes:
 *   - Old permissions for the role are deleted before inserting new ones.
 *   - In production, requires the `edit_role` permission.
 *   - Error messages are returned in the language specified by the `accept-language` header.
 */
export async function PUT(req: NextRequest, { params }: any): Promise<NextResponse> {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const roleId = params.roleId;

    const payload = await req.json();
    const { tenant_id, name, name_ar, description,slug, permissions } = payload;

    // Permission checks
    if (process.env.NODE_ENV === "production") {
      const canEdit = await hasPermission(user, "edit_role");
      if (!canEdit)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      if (tenant_id) {
        const allowed = await hasTenantAccess(user, tenant_id);
        if (!allowed)
          return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Validation
    const rules: any = {
      name: [
        { required: true, label: requiredFieldLabels.name[lang] },
        { minLength: 3 },
        { maxLength: 100 },
      ],
      name_ar: [{ required: false }, { minLength: 3 }, { maxLength: 100 }],
      description: [{ required: false }, { maxLength: 255 }],
      tenant_id: [
        { required: true, label: requiredFieldLabels.tenant_id[lang] },
        { type: "number" },
      ],
      
      slug: [
        { required: true, label: requiredFieldLabels.slug[lang] },
         { minLength: 3 },
        { maxLength: 50 },
      ],
      permissions: [
        { required: true, label: requiredFieldLabels.permissions[lang] },
        { type: "array" },
      ],
    };
    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    const pool = await dbConnection();

    // Check if role exists
    const [existingRole] = await pool.query(`SELECT * FROM roles WHERE id = ?`, [roleId]);
    if (!(existingRole as any[]).length)
      return NextResponse.json({ error: getErrorMessage("roleNotFound", lang) }, { status: 404 });

    const targetRole = (existingRole as any[])[0];

    // Check for name conflicts
    if (name) {
      const [conflict] = await pool.query(
        `SELECT * FROM roles WHERE name = ? AND id != ? AND tenant_id = ?`,
        [name, roleId, tenant_id || targetRole.tenant_id]
      );
      if ((conflict as any[]).length > 0)
        return NextResponse.json({ error: getErrorMessage("roleExists", lang) }, { status: 409 });
    }

    // Build dynamic update query
    const fields: string[] = [];
    const values: any[] = [];
    if (name) { fields.push("name = ?"); values.push(name); }
    if (name_ar) { fields.push("name_ar = ?"); values.push(name_ar); }
    if (description) { fields.push("description = ?"); values.push(description); }
    if (tenant_id) { fields.push("tenant_id = ?"); values.push(tenant_id); }
    if (slug) { fields.push("slug = ?"); values.push(slug); }
    if (fields.length > 0) {
      await pool.query(`UPDATE roles SET ${fields.join(", ")} WHERE id = ?`, [...values, roleId]);
    }

    // Update permissions
    if (permissions) {
      await pool.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
      const values = permissions.map((pid: number) => [roleId, pid]);
      await pool.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ?`, [values]);
    }

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });
  } catch (error) {
    console.error("edit role error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/roles/[roleId]
 *
 * Returns a single role for a tenant. In production, the requester must have `view_roles` permission
 * and tenant access is verified.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - roleId (number, required) : Role ID to fetch
 *
 * Query Parameters:
 *   - tenant_id (number, required in prod) : Used for access verification
 *
 * Responses:
 *   - 200: role object                  : Selected role fields with permissions
 *   - 400: { error }                    : Missing roleId or tenant_id
 *   - 401: { error }                    : Unauthorized
 *   - 404: { error }                    : Role not found
 *   - 500: { error }                    : Internal server error
 */
export async function GET(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);
    const { searchParams } = new URL(req.url);
    const tenant_id = searchParams.get("tenant_id");

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Permission check in production
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_roles");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    const roleId = params.roleId;
    if (!roleId) {
      return NextResponse.json({ error: getErrorMessage("missingRoleId", lang) }, { status: 400 });
    }

    const pool = await dbConnection();

    // Fetch single role by ID
    const [rows] = await pool.query(
      `SELECT id, tenant_id, name, name_ar, description, slug, created_at
       FROM roles
       WHERE id = ? AND tenant_id = ?`,
      [roleId, tenant_id]
    );

    const foundRole = (rows as any[])[0];
    if (!foundRole) {
      return NextResponse.json({ error: getErrorMessage("roleNotFound", lang) }, { status: 404 });
    }

    // Attach permissions
    const [perms] = await pool.query(
      `SELECT rp.permission_id, p.name,p.name_ar, p.code, p.description,p.description_ar
       FROM role_permissions rp
       JOIN permissions p ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [foundRole.id]
    );
    foundRole.permissions = perms;

    return NextResponse.json(foundRole, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * DELETE /api/v1/admin/roles/[roleId]
 *
 * Deletes a role for a tenant. Production requests require `delete_role` permission
 * and tenant access verification.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - roleId (number, required)     : ID of the role to delete
 *
 * Request Body:
 *   - tenant_id (number, required)  : Tenant ID the role belongs to
 *
 * Responses:
 *   - 200: { message }              : Role deleted successfully
 *   - 400: { error }                : Missing roleId or tenant_id
 *   - 401: { error }                : Unauthorized (permission or tenant access denied)
 *   - 404: { error }                : Role not found in tenant
 *   - 500: { error }                : Internal server error
 *
 * Notes:
 *   - Checks `delete_role` permission in production.
 *   - Confirms the role belongs to the specified tenant.
 *   - Deletes the role permanently.
 */

export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return NextResponse.json(
        { error: getErrorMessage("unauthorized", lang) },
        { status: 400 }
      );
    }

    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_role");
      if (!hasAccess) {
        return NextResponse.json(
          { error: getErrorMessage("unauthorized", lang) },
          { status: 401 }
        );
      }

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) {
        return NextResponse.json(
          { error: getErrorMessage("unauthorized", lang) },
          { status: 401 }
        );
      }
    }
    const roleId = params.roleId;
    if (!roleId) {
      return NextResponse.json({ error: getErrorMessage("missingRoleId", lang) }, { status: 400 });
    }

    // Ensure target role exists and belongs to tenant
   type TargetRole = { id: number; tenant_id: number };

    const [targetRoles] = await pool.query(
  `SELECT id, tenant_id
    FROM roles
    WHERE id = ? AND tenant_id = ? LIMIT 1`,
  [roleId, tenant_id]
);

    const rolesArr = targetRoles as TargetRole[];
    if (!(Array.isArray(rolesArr) && rolesArr.length)) {
      return NextResponse.json(
        { error: lang === "ar" ? "الدور غير موجود." : "Role not found." },
        { status: 404 }
      );
    }

    
    await pool.query(
      `DELETE FROM roles
        WHERE role_id = ? AND tenant_id = ?`,
      [roleId, tenant_id]
    );


    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}




