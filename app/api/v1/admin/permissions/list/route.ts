import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { getUserData, hasPermission, hasTenantAccess } from "../../../functions/permissions";

// Localized messages
const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    missingTenantId: "Tenant ID is required.",
  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    missingTenantId: "معرف التينانت مطلوب.",
  },
};

// Helper
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}


/**
 * GET /api/v1/admin/permissions/list
 *
 * Returns all permissions (no pagination). Production requires:
 * - `view_roles` permission
 * - tenant access validation
 *
 * Query Parameters:
 *   - tenant_id (number, required)
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

    // Get user
    const user: any = await getUserData(req);

    // Check permission
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_roles");
      if (!hasAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Check tenant access
    if (process.env.NODE_ENV === "production" && tenant_id) {
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) {
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      }
    }

    // Get permissions
    const [permissions] = await pool.query(
      `SELECT * FROM permissions
       LIMIT 9999`
    );

    return NextResponse.json(
      { data: permissions },
      { status: 200 }
    );

  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("GET permissions error:", error);

    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
