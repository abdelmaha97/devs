import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../functions/db";
import { validateFields } from "../../functions/validation";
import { getUserData, hasPermission, hasTenantAccess } from "../../functions/permissions";

// Localized messages
const errorMessages = {
  en: {
    missingFields: "Required fields are missing.",
    unauthorized: "Unauthorized access.",
    roleExists: "Role with this name already exists.",
    serverError: "Internal server error.",
    missingTenantId: "Tenant ID is required.",
    createdSuccess: "Role created successfully.",
    deletedSuccess: "Roles deleted successfully.",
    missingRule: "Invalid role_ids payload.",
    NoRulesFound: "No roles found for deletion."

  },
  ar: {
    missingFields: "الحقول المطلوبة مفقودة.",
    unauthorized: "دخول غير مصرح به.",
    roleExists: "يوجد دور بنفس الاسم.",
    serverError: "خطأ في الخادم الداخلي.",
    missingTenantId: "معرف المستأجر (الشركة) مطلوب.",
    createdSuccess: "تم إنشاء الدور بنجاح.",
    deletedSuccess: "تم حذف الادوار بنجاح",
    missingRule: "قائمة الادوار غير صالحة.",
    NoRulesFound: "لم يتم العثور على أي دور."
  },
};

// Helper
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

// Required field labels
const requiredFieldLabels = {
  name: { en: "Role Name", ar: "اسم الدور" },
  name_ar: { en: "Role Name (Arabic)", ar: "اسم الدور بالعربي" },
  slug:{ en: "slug", ar: "السلاج" },
  description: { en: "Description", ar: "الوصف" },
  tenant_id: { en: "Tenant", ar: "الشركة" },
  permissions: { en: "Permissions", ar: "الصلاحيات" },
};

/**
 * POST /api/v1/admin/roles
 *
 * Creates a new role and assigns permissions to it.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Request Body:
 *   - tenant_id: number (required) – ID of the tenant/law firm
 *   - name: string (required) – Role name
 *   - name_ar: string (optional) – Role name in Arabic
 *   - slug: string or number (required) – Unique identifier
 *   - description: string (optional) – Role description
 *   - permissions: number[] (required) – Array of permission IDs to assign
 *
 * Responses:
 *   - 201: { message } – role created successfully
 *   - 400: { error } – validation error or missing tenant_id
 *   - 401: { error } – unauthorized access
 *   - 409: { error } – role already exists
 *   - 500: { error } – server error
 */

export async function POST(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const payload = await req.json();
    const { tenant_id, name, name_ar,slug, description, permissions } = payload;
    
    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
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
    if (!valid) {
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const pool = await dbConnection();

    // Permission + Law Firm Access
    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const canCreate = await hasPermission(user, "create_role");
      if (!canCreate) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Check if role exists
    const [existing] = await pool.query(
      `SELECT id FROM roles WHERE name = ? AND tenant_id = ?`,
      [name, tenant_id]
    );
    if ((existing as any[]).length > 0) {
      return NextResponse.json({ error: getErrorMessage("roleExists", lang) }, { status: 409 });
    }

    // Insert role
    const [insertResult] = await pool.query(
      `INSERT INTO roles (tenant_id, name, name_ar, slug, description, created_at)
       VALUES (?, ?, ?, ?,?, NOW())`,
      [tenant_id, name, name_ar || null,slug, description || null]
    );

    if ((insertResult as any).insertId && Array.isArray(permissions) && permissions.length > 0) {
      const roleId = (insertResult as any).insertId;
      const values = permissions.map((pid: number) => [roleId, pid]);
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ?`,
        [values]
      );
    }

    return NextResponse.json({ message: getErrorMessage("createdSuccess", lang) }, { status: 201 });

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/roles
 *
 * Lists roles for a given tenant with pagination, search, and configurable sorting.
 * Production traffic must pass `view_roles` and tenant access checks.
 *
 * Query Parameters:
 *   - tenant_id (number, required)       : Tenant whose roles should be returned
 *   - page (number, default = 1)         : 1-based page index
 *   - pageSize (number, default = 20)    : Items per page
 *   - search (string, optional)          : Partial match against name or name_ar
 *   - sortBy (string, default = created_at): Column to sort by
 *   - sortOrder ("asc" | "desc", default = "desc")
 *
 * Responses:
 *   - 200: { count, page, pageSize, totalPages, data }
 *   - 401: { error }                     : Permission or tenant access denied
 *   - 500: { error }                     : Failed to fetch roles
 */

export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "20");
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder =
      (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const tenant_id = searchParams.get("tenant_id");

    // Validate tenant_id
    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Permissions check
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_roles");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Build WHERE
    let where = "r.tenant_id = ?";
    const params: any[] = [tenant_id];

    if (search) {
      where += " AND (r.name LIKE ? OR r.name_ar LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count FROM roles r WHERE ${where}`,
      params
    );
    const count = (countRows as any)[0]?.count || 0;
    const totalPages = Math.ceil(count / pageSize);

    // Get roles
    const [roles] = await pool.query(
      `SELECT r.id, r.tenant_id, r.name, r.name_ar, r.slug,r.description, r.created_at
       FROM roles r
       WHERE ${where}
       ORDER BY r.${sortBy} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    );

    // Attach permissions for each role
    for (const role of roles as any[]) {
      const [perms] = await pool.query(
        `
    SELECT 
      rp.permission_id, 
      p.id AS id,
      ${lang === "ar" ? "p.name_ar AS name, p.description_ar AS description" : "p.name, p.description"}
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = ?
    `,
        [role.id]
      );

      role.permissions = perms;
    }


    return NextResponse.json(
      {
        count,
        page,
        pageSize,
        totalPages,
        data: roles,
      },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET roles error:", error);

    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
/**
 * DELETE /api/v1/admin/roles
 *
 * Bulk-removes roles that belong to a law firm. Requests that reach production must
 * pass `delete_role` checks, have law-firm access, and Super Admin roles are skipped.
 *
 * Request Body:
 *   - law_firm_id (number, required)       : Firm whose roles are being removed
 *   - role_ids (number[], required)        : Role IDs to delete in bulk
 *
 * Responses:
 *   - 200: { message }                     : Describes how many roles were deleted/skipped
 *   - 400: { error }                       : Missing or invalid payload
 *   - 401: { error }                       : Permission or law-firm access denied
 *   - 404: { error }                       : No roles matched the supplied IDs
 *   - 500: { error }                       : Internal server error
 */
export async function DELETE(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id, role_ids } = await req.json();

    if (!tenant_id || !Array.isArray(role_ids) || role_ids.length === 0) {
      return NextResponse.json(
        { error: getErrorMessage("unauthorized", lang) },
        { status: 400 }
      );
    }

    const normalizedIds = role_ids
      .map((id: any) => Number(id))
      .filter((id: number) => !Number.isNaN(id));

    if (normalizedIds.length === 0) {
      return NextResponse.json({ error: getErrorMessage("NoRulesFound", lang) }, { status: 404 });
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

    const [targetRoles] = await pool.query(
      `SELECT id, name FROM roles WHERE id IN (?) AND tenant_id = ?`,
      [normalizedIds, tenant_id]
    );
    const rolesArr = targetRoles as { id: number; name: string }[];

    if (!rolesArr.length) {
      return NextResponse.json({ error: getErrorMessage("missingRule", lang) }, { status: 404 });
    }

    const deletableIds = rolesArr.map(r => r.id);

    // الحذف
    await pool.query(`DELETE FROM roles WHERE id IN (?)`, [deletableIds]);

    const message = lang === "ar"
      ? `تم حذف ${deletableIds.length} دور${deletableIds.length === 1 ? "" : "ات"} بنجاح.`
      : `Deleted ${deletableIds.length} role(s) successfully.`;

    return NextResponse.json({ error: getErrorMessage("deletedSuccess", lang) }, { status: 200 });
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}