import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

// Error messages
const errorMessages = {
  en: {
    missingRequiredFields: "Missing required fields.",
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    success: "Branch created successfully.",
    branchExists: "Branch already exists.",
    missingTenantId: "Tenant ID is missing.",
    missingBranchId: "Branch ID is missing.",
    branchNotFound: "Branch not found.",
    updatedSuccess: "Branch updated successfully.",
    deletedSuccess: "Branch deleted successfully."
  },
  ar: {
    missingRequiredFields: "الحقول المطلوبة غير مكتملة.",
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    success: "تم إنشاء الفرع بنجاح.",
    branchExists: "الفرع هذا موجود مسبقا",
    missingTenantId: "معرّف المنظمة مفقود.",
    missingBranchId: "معرّف الفرع مفقود.",
    branchNotFound: "الفرع غير موجود.",
    updatedSuccess: "تم تعديل بيانات الفرع بنجاح.",
    deletedSuccess: "تم حذف بيانات الفرع بنجاح"
  }
};

function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}
const branchRequiredLabels: Record<
  "tenant_id" | "name" | "name_ar" | "address" | "address_ar" | "latitude" | "longitude",
  { en: string; ar: string }
> = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  name: { en: "Branch Name", ar: "اسم الفرع" },
  name_ar: { en: "Arabic Branch Name", ar: "اسم الفرع بالعربي" },
  address: { en: "Address", ar: "العنوان" },
  address_ar: { en: "Arabic Address", ar: "العنوان بالعربي" },
  latitude: { en: "Latitude", ar: "خط العرض" },
  longitude: { en: "Longitude", ar: "خط الطول" },
};
/**
 * PUT /api/v1/admin/branches/[branchId]
 *
 * Updates a branch's information for a given tenant.
 * Production requests must pass `edit_branch` permission and tenant access check.
 *
 * Path Parameters:
 *   - branchId (number, required)       : ID of the branch to update
 *
 * Request Body:
 *   - tenant_id (number, required)      : Tenant that owns the branch
 *   - name (string, required)           : Branch name
 *   - name_ar (string, optional)        : Branch name in Arabic
 *   - address (string, optional)        : Branch address
 *   - address_ar (string, optional)     : Branch address in Arabic
 *   - latitude (decimal, optional)      : Branch latitude
 *   - longitude (decimal, optional)     : Branch longitude
 *
 * Validation:
 *   - Required fields must be present
 *   - Min/max length checks for string fields
 *   - Type checks for numeric/decimal fields
 *
 * Responses:
 *   - 200: { message }                   : Branch updated successfully
 *   - 400: { error }                     : Missing required fields or invalid payload
 *   - 401: { error }                     : Permission or tenant access denied
 *   - 404: { error }                     : Branch not found
 *   - 500: { error }                     : Internal server error
 */

export async function PUT(req: NextRequest, { params }: any): Promise<NextResponse> {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    const branchId = params.branchId;
    if (branchId==null) {
      return NextResponse.json({ error: getErrorMessage("missingBranchId", lang) }, { status: 400 });
    }

    const payload = await req.json();
    const { tenant_id, name, name_ar, address, address_ar, latitude, longitude } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_branch");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validation
    const rules: any = {
      name: [
        { required: true, label: branchRequiredLabels.name[lang] },
        { minLength: 3, label: branchRequiredLabels.name[lang] },
        { maxLength: 200, label: branchRequiredLabels.name[lang] },
      ],
      name_ar: [
        { required: false, label: branchRequiredLabels.name_ar[lang] },
        { minLength: 3, label: branchRequiredLabels.name_ar[lang] },
        { maxLength: 200, label: branchRequiredLabels.name_ar[lang] },
      ],
      tenant_id: [
        { required: true, label: branchRequiredLabels.tenant_id[lang] },
        { type: "number", label: branchRequiredLabels.tenant_id[lang] },
      ],
      address: [
        { required: false, label: branchRequiredLabels.address[lang] },
        { minLength: 3, label: branchRequiredLabels.address[lang] },
        { maxLength: 255, label: branchRequiredLabels.address[lang] },
      ],
      address_ar: [
        { required: false, label: branchRequiredLabels.address_ar[lang] },
        { minLength: 3, label: branchRequiredLabels.address_ar[lang] },
        { maxLength: 255, label: branchRequiredLabels.address_ar[lang] },
      ],
      latitude: [
        { required: false, label: branchRequiredLabels.latitude[lang] },
        { type: "decimal", label: branchRequiredLabels.latitude[lang] },
      ],
      longitude: [
        { required: false, label: branchRequiredLabels.longitude[lang] },
        { type: "decimal", label: branchRequiredLabels.longitude[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    const pool = await dbConnection();

    // Check if branch exists
    const [existingBranch] = await pool.query(
      `SELECT * FROM branches WHERE id = ? AND tenant_id = ?`,
      [branchId, tenant_id]
    );
    if (!(existingBranch as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("branchNotFound", lang) }, { status: 404 });
    }
    // Check name uniqueness
    if (name) {
      const [conflict] = await pool.query(
        `SELECT * FROM branches WHERE name = ? AND id != ? AND tenant_id = ?`,
        [name, branchId, tenant_id]
      );
      if ((conflict as any[]).length > 0) {
        return NextResponse.json({ error: getErrorMessage("branchExists", lang) }, { status: 409 });
      }
    }
    // Build update dynamically
    const fields: string[] = [];
    const values: any[] = [];

    if (name) { fields.push("name = ?"); values.push(name); }
    if (name_ar) { fields.push("name_ar = ?"); values.push(name_ar); }
    if (address) { fields.push("address = ?"); values.push(address); }
    if (address_ar) { fields.push("address_ar = ?"); values.push(address_ar); }
    if (latitude !== undefined) { fields.push("latitude = ?"); values.push(latitude); }
    if (longitude !== undefined) { fields.push("longitude = ?"); values.push(longitude); }

    if (fields.length > 0) {
      await pool.query(
        `UPDATE branches SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
        [...values, branchId, tenant_id]
      );
    }

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("edit branch error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * GET /api/v1/admin/branches/[branchId]
 *
 * Returns a single branch for a tenant. Production traffic must pass `view_branches`
 * and tenant access checks.
 *
 * Path Parameters:
 *   - branchId (number, required)
 *
 * Query Parameters:
 *   - tenant_id (number, required in prod)
 *
 * Responses:
 *   - 200: branch object
 *   - 400: { error } : branchId or tenant_id missing
 *   - 401: { error } : Permission or tenant access denied
 *   - 404: { error } : Branch not found
 *   - 500: { error } : Internal server error
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

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_branches");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const branchId = params.branchId;
    if (!branchId) {
      return NextResponse.json({ error: getErrorMessage("missingBranchId", lang) }, { status: 400 });
    }

    const pool = await dbConnection();

    const [rows] = await pool.query(
      `SELECT id, tenant_id, name, name_ar, address, address_ar, latitude, longitude, created_at
       FROM branches
       WHERE id = ? AND tenant_id = ?`,
      [branchId, tenant_id]
    );

    const foundBranch = (rows as any[])[0];
    if (!foundBranch) {
      return NextResponse.json({ error: getErrorMessage("branchNotFound", lang) }, { status: 404 });
    }

    return NextResponse.json(foundBranch, { status: 200 });
  } catch (error) {
    console.error("GET branch by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/branches/[branchId]
 *
 * Soft-deletes a single branch (optional: you can implement is_active → 0 or just delete). 
 * Production traffic must pass `delete_branch` and confirm tenant access.
 *
 * Path Parameters:
 *   - branchId (number, required)
 *
 * Request Body:
 *   - tenant_id (number, required)
 *
 * Responses:
 *   - 200: { message }  : Branch deleted successfully
 *   - 400: { error }    : tenant_id or branchId missing
 *   - 401: { error }    : Permission or tenant access denied
 *   - 404: { error }    : Branch not found in tenant
 *   - 500: { error }    : Internal server error
 */
export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();
    const branchId = params.branchId;


    if (!branchId) {
      return NextResponse.json({ error: getErrorMessage("missingBranchId", lang) }, { status: 400 });
    }

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }
    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_branch");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const [targetBranches] = await pool.query(
      `SELECT id, tenant_id
       FROM branches
       WHERE id = ? AND tenant_id = ?`,
      [branchId, tenant_id]
    );

    const branchesArr = targetBranches as any[];
    if (!branchesArr.length) {
      return NextResponse.json({ error: getErrorMessage("branchNotFound", lang) }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM branches
       WHERE id = ? AND tenant_id = ?`,
      [branchId, tenant_id]
    );

    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("DELETE branch error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
