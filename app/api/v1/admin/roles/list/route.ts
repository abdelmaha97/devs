import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { validateFields } from "../../../functions/validation";
import { getUserData, hasPermission, hasTenantAccess } from "../../../functions/permissions";

// Localized messages
const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
  
  },
};

// Helper
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

/**
 * GET /api/v1/admin/roles/list
 *
 * Returns every role for a given tenant_id (no pagination). The caller must supply
 * `tenant_id`; production requests also enforce `view_roles` permission plus
 * tenant-access checks.
 *
 * Query Parameters:
 *   - tenant_id (number, required)       : tenant whose roles should be returned
 *
 * Responses:
 *   - 200: { data }                        : Array of roles (id, names, descriptions)
 *   - 400: { error }                       : tenant_id missing
 *   - 401: { error }                       : Permission or tenant access denied
 *   - 500: { error }                       : Internal server error
 */
export async function GET(req: NextRequest) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();

    // Parse query params
    const { searchParams } = new URL(req.url);

    const tenant_id = searchParams.get("tenant_id");

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    // Get user and check permissions
    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_roles");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    if (process.env.NODE_ENV === "production" && tenant_id) {
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Build WHERE clause
    let where = "tenant_id = ?"; // default where
    let params: any[] = [];
    params.push(tenant_id);

    // Get paginated data
    const [roles] = await pool.query(
      `SELECT role_id, tenant_id, name, name_ar, slug, description, created_at
       FROM roles
       WHERE ${where}
       LIMIT 9999`,
      [...params]
    );

    return NextResponse.json(
      {
        data: roles,
      },
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
