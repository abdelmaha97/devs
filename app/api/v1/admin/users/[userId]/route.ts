
import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";
import { validateFields } from "../../../functions/validation";

// Error messages
const errorMessages = {
  en: {
    serverError: "Internal server error.",
    unauthorized: "Unauthorized access.",
    userExists: "Email already exists.",
    updatedSuccess: "User updated successfully.",
    userNotFound: "User not found",
    missingUserId: "User ID is missing",
    deletedSuccess:"User deleted successfully"
  },
  ar: {
    serverError: "خطأ في الخادم الداخلي.",
    unauthorized: "دخول غير مصرح به.",
    userExists: "البريد الإلكتروني غير متاح.",
    updatedSuccess: "تم تحديث بيانات المستخدم بنجاح.",
    userNotFound: "المستخدم غير موجود",
    missingUserId: "معرّف المستخدم مفقود",
    deletedSuccess:"تم حذف المستخدم بنجاح"
  },
};
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

/**
 * PUT /api/v1/admin/users/[userId]
 *
 * Updates a user for a tenant. Only supplied fields are updated.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar"
 *
 * Path Parameters:
 *   - userId (number, required)
 *
 * Request Body:
 *   - tenant_id (number, required)
 *   - full_name (string, required)
 *   - full_name_ar (string, optional)
 *   - email (string, required)
 *   - phone (string, optional)
 *   - password (string, optional)
 *   - role_id (number, required)
 *   - status (string, optional)
 *
 * Responses:
 *   - 200: { message }
 *   - 400: { error }
 *   - 401: { error }
 *   - 404: { error }
 *   - 409: { error }
 *   - 500: { error }
 */
export async function PUT(req: NextRequest, { params }: any): Promise<NextResponse> {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    const userId = params.userId;
    if (!userId) {
      return NextResponse.json({ error: getErrorMessage("missingUserId", lang) }, { status: 400 });
    }

    const payload = await req.json();
    const { tenant_id, full_name, full_name_ar, email, phone, password, role_id, status } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_user");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validation
    const rules: any = {
      full_name: [{ required: true, label: lang === "ar" ? "الاسم" : "Full Name" }, { minLength: 3, label: "Full Name" }, { maxLength: 200, label: "Full Name" }],
      full_name_ar: [{ required: false, minLength: 3, maxLength: 200, label: "Arabic Name" }],
      email: [{ required: true, type: "email", label: "Email" }],
      phone: [{ phone: false, label: "Phone" }],
      role_id: [{ required: true, type: "number", label: "Role ID" }],
      tenant_id: [{ required: true, type: "number", label: "Tenant ID" }],
    };
    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    const pool = await dbConnection();

    // Check if user exists
    const [existingUser] = await pool.query(
      `SELECT * FROM users WHERE id = ? AND tenant_id = ?`,
      [userId, tenant_id]
    );
    if (!(existingUser as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("userNotFound", lang) }, { status: 404 });
    }

    // Check email uniqueness
    if (email) {
      const [conflict] = await pool.query(
        `SELECT * FROM users WHERE email = ? AND id != ? AND tenant_id = ?`,
        [email, userId, tenant_id]
      );
      if ((conflict as any[]).length > 0) {
        return NextResponse.json({ error: getErrorMessage("userExists", lang) }, { status: 409 });
      }
    }

    // Hash password if provided
    let password_hash = null;
    if (password) password_hash = await argon2.hash(password);

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    if (full_name) { fields.push("full_name = ?"); values.push(full_name); }
    if (full_name_ar) { fields.push("full_name_ar = ?"); values.push(full_name_ar); }
    if (email) { fields.push("email = ?"); values.push(email); }
    if (phone) { fields.push("phone = ?"); values.push(phone); }
    if (password_hash) { fields.push("password_hash = ?"); values.push(password_hash); }
    if (role_id) { fields.push("role_id = ?"); values.push(role_id); }
  if (typeof status === "string") {
    fields.push("status = ?");
    values.push(status);
}


    if (fields.length > 0) {
      await pool.query(
        `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
        [...values, userId, tenant_id]
      );
    }

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });
  } catch (error) {
    console.error("edit user error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * GET /api/v1/admin/users/[userId]
 *
 * Returns a single non-deleted user for a tenant. Production traffic must pass `view_users`
 * and tenant access checks.
 *
 * Path Parameters:
 *   - userId (number, required)
 *
 * Query Parameters:
 *   - tenant_id (number, required in prod)
 *
 * Responses:
 *   - 200: user object
 *   - 400: { error } : userId or tenant_id missing
 *   - 401: { error } : Permission or tenant access denied
 *   - 404: { error } : User not found / deleted
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
      const hasAccess = await hasPermission(user, "view_users");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const userId = params.userId;
    if (!userId) {
      return NextResponse.json({ error: getErrorMessage("missingUserId", lang) }, { status: 400 });
    }

    const pool = await dbConnection();

const [rows] = await pool.query(
  `SELECT 
      u.id,
      u.tenant_id,
      r.id AS role_Id,
      u.full_name,
      u.full_name_ar,
      u.email,
      u.phone,
      u.status,
      u.created_at,
      r.name     AS role_name,
      r.name_ar  AS role_name_ar
   FROM users u
   LEFT JOIN roles r ON r.id = u.role_id
   WHERE u.id = ? 
     AND u.tenant_id = ? 
     AND u.status != 'deleted'
   LIMIT 1`,
  [userId, tenant_id]
);

    const foundUser = (rows as any[])[0];
    if (!foundUser) {
      return NextResponse.json({ error: getErrorMessage("userNotFound", lang) }, { status: 404 });
    }

    return NextResponse.json(foundUser, { status: 200 });
  } catch (error) {
    console.error("GET user by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/users/[userId]
 *
 * Soft-deletes a single user (status → 0). Production traffic must pass `delete_user`
 * and confirm tenant access.
 *
 * Path Parameters:
 *   - userId (number, required)
 *
 * Request Body:
 *   - tenant_id (number, required)
 *
 * Responses:
 *   - 200: { message }  : User deleted successfully
 *   - 400: { error }    : tenant_id or userId missing
 *   - 401: { error }    : Permission or tenant access denied
 *   - 404: { error }    : User not found in tenant
 *   - 500: { error }    : Internal server error
 */
export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();
    const user_id = params.userId;

    if (!tenant_id || !user_id) {
      return NextResponse.json(
        { error: getErrorMessage("missingUserId", lang) },
        { status: 400 }
      );
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_user");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Ensure target user exists and belongs to tenant
    const [targetUsers] = await pool.query(
      `SELECT id, tenant_id, status
       FROM users
       WHERE id = ? AND tenant_id = ? AND status != 'deleted'
       LIMIT 1`,
      [user_id, tenant_id]
    );

    const usersArr = targetUsers as any[];
    if (!usersArr.length) {
      return NextResponse.json({ error: getErrorMessage("userNotFound", lang) }, { status: 404 });
    }

    await pool.query(
      `UPDATE users
       SET status = 'deleted'
       WHERE id = ? AND tenant_id = ?`,
      [user_id, tenant_id]
    );

    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("DELETE user error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}













