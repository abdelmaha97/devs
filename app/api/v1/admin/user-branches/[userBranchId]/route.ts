import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { validateFields } from "../../../functions/validation";
import argon2 from "argon2";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";

// Error messages
const errorMessages = {
  en: {
    unauthorized: "Unauthorized access.",
    serverError: "Internal server error.",
    userNotFoundFortenant: "User not found For this tenant",
    branchNotFoundFortenant: "Branch not found For this tenant",
    alreadyAssigned: "User already assigned to this branch.",
    assignedSuccess: "User assigned to branch successfully.",
    deletedSuccess: "User unassigned from branch successfully.",
    missingUserId: "User ID is missing.",
    missingBranchId: "Branch ID is missing.",
    missingUserBranchId: "Branch user IDs are missing.",
    tenantMismatch: "The user/branch you are trying to delete does not belong to the entered tenant",
    updatedSuccess:"User branch updated successfully",
    userBranchIdNotFound:"userBranch Id Not Found"
    

  },
  ar: {
    unauthorized: "دخول غير مصرح به.",
    serverError: "خطأ في الخادم الداخلي.",
    userNotFoundFortenant: "المستخدم غير موجود لهذه الشركة.",
    branchNotFoundFortenant: "الفرع غير موجود لهذه الشركة.",
    alreadyAssigned: "المستخدم مرتبط بالفعل بهذا الفرع.",
    assignedSuccess: "تم ربط المستخدم بالفرع بنجاح.",
    deletedSuccess: "تم إزالة المستخدم من الفرع بنجاح.",
    missingUserId: "معرّف المستخدم مفقود.",
    missingBranchId: "معرّف الفرع مفقود.",
    missingUserBranchId: "معرّفات مستخدمين الفروع مفقودة.",
    tenantMismatch: "اليوزر/الفرع الذي تحاول حذفه لا ينتمي إلى نفس المنظمة المدخلة",
    updatedSuccess:"تم تحديث الفرع للمستخدم بنجاح",
    userBranchIdNotFound:"المعرف الذي ادخلته غير موجود"
  },
};
function getErrorMessage(key: keyof typeof errorMessages["en"], lang: "en" | "ar" = "en") {
  return errorMessages[lang][key] || errorMessages["en"][key];
}


const userBranchRequiredLabels: Record<"user_id"|"user_branch_id" | "branch_id" | "tenant_id", { en: string; ar: string }> = {
   user_id: { en: "User", ar: "المستخدم" },
   user_branch_id: { en: "user_branch_id", ar: "المعرف" },
  branch_id: { en: "Branch", ar: "الفرع" },
  tenant_id: { en: "Tenant", ar: "المنظمة" },
};/**
 * PUT /api/v1/admin/user-branches/[userBranchId]
 *
 * Updates an existing user branch assignment by changing
 * the branch linked to a specific user.
 * Both user and branch must belong to the same tenant.
 * Production traffic requires `update_user_branch` permission and tenant access.
 *
 * URL Parameters:
 *   - userBranchId (number, required)  : ID of the user_branch record to update
 *
 * Request Body:
 *   - tenant_id (number, required)       : Tenant ownership validation
 *   - user_id (number, required)         : The user whose branch assignment is being updated
 *   - branch_id (number, required)       : The new branch to assign the user to
 *
 * Validation:
 *   - Ensures all required values are provided and numeric
 *   - Verifies the user_branch record exists
 *   - Confirms user exists, is active, and belongs to the specified tenant
 *   - Confirms branch exists and belongs to the same tenant
 *   - Prevents updating if the user is already assigned to the same branch
 *
 * Responses:
 *   - 200: { message } : Branch assignment updated successfully
 *   - 400: { error }   : Missing or invalid fields
 *   - 401: { error }   : Unauthorized (missing permission or tenant access)
 *   - 404: { error }   : Record not found for user, branch, or user_branch
 *   - 409: { error }   : User already assigned to this branch
 *   - 500: { error }   : Internal server error
 */

export async function PUT(req: NextRequest, { params }: any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const payload = await req.json();
    const { tenant_id, user_id, branch_id } = payload;
    const userBranchId = params.userBranchId;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Validation rules
    const rules: any = {
      tenant_id: [
        { required: true, label: userBranchRequiredLabels.tenant_id[lang] },
        { type: "number", label: userBranchRequiredLabels.tenant_id[lang] },
      ],
      user_id: [
        { required: true, label: userBranchRequiredLabels.user_id[lang] },
        { type: "number", label: userBranchRequiredLabels.user_id[lang] },
      ],
      branch_id: [
        { required: true, label: userBranchRequiredLabels.branch_id[lang] },
        { type: "number", label: userBranchRequiredLabels.branch_id[lang] },
      ],
    };

    const { valid, errors } = validateFields(payload, rules, lang);
    if (!valid) return NextResponse.json({ error: errors }, { status: 400 });

    // Auth user
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "update_user_branch");
      if (!hasAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Check if user_branch exists
    const [foundUsersBranchs] = await pool.query(
      `SELECT id, user_id, branch_id FROM user_branches WHERE id = ? LIMIT 1`,
      [userBranchId]
    );
    const foundUserBranch = (foundUsersBranchs as any[])[0];
    if (!foundUserBranch)
      return NextResponse.json({ error: getErrorMessage("userBranchIdNotFound", lang) }, { status: 404 });

    // Check if user exists
    const [foundUsers] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND tenant_id= ? AND status != 'deleted' LIMIT 1`,
      [user_id, tenant_id]
    );
    const foundUser = (foundUsers as any[])[0];
    if (!foundUser)
      return NextResponse.json({ error: getErrorMessage("userNotFoundFortenant", lang) }, { status: 404 });

    // Check if branch exists and belongs to same tenant
    const [Branches] = await pool.query(
      `SELECT id FROM branches WHERE id = ? AND tenant_id= ? LIMIT 1`,
      [branch_id, tenant_id]
    );
    const Branch = (Branches as any[])[0];
    if (!Branch)
      return NextResponse.json({ error: getErrorMessage("branchNotFoundFortenant", lang) }, { status: 404 });

    // Check if already assigned to same branch (ignore current record)
    if (foundUserBranch.branch_id !== branch_id) {
      const [existingAObj] = await pool.query(
        `SELECT id FROM user_branches WHERE user_id = ? AND branch_id = ?`,
        [user_id, branch_id]
      );
      if ((existingAObj as any[]).length > 0) {
        return NextResponse.json({ error: getErrorMessage("alreadyAssigned", lang) }, { status: 409 });
      }
    }

    // Update branch only
    await pool.query(
      `UPDATE user_branches SET branch_id = ? , user_id=? WHERE id = ?`,
      [branch_id,user_id, userBranchId]
    );

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("Update user branch error:", error);
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}
/**
 * DELETE /api/v1/admin/user-branches/[userBranchId]
 *
 * Unassigns a single user from a branch.
 * Production traffic requires `delete_user_branch` permission
 * and valid tenant access.
 *
 * URL Parameters:
 *   - userBranchId (number, required) : Assignment ID to delete
 *
 * Request Body:
 *   - tenant_id (number, required) : Tenant for access validation
 *   - Confirms assignment exists and belongs to the given tenant
 *
 * Responses:
 *   - 200: { message } : Assignment deleted successfully
 *   - 400: { error }   : Invalid input or tenant mismatch
 *   - 401: { error }   : Unauthorized access
 *   - 404: { error }   : Assignment not found
 *   - 500: { error }   : Internal server error
 */
export async function DELETE(req: NextRequest, { params }: any) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
       const { tenant_id } = await req.json();
    const userBranchId = params.userBranchId;
    // Validate input
    if (!tenant_id) {
      return NextResponse.json(
        { error: getErrorMessage("unauthorized", lang) },
        { status: 400 }
      );
    }

    // authenticated user
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_user_branch");
      if (!hasAccess)
        return NextResponse.json(
          { error: getErrorMessage("unauthorized", lang) },
          { status: 401 }
        );

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed)
        return NextResponse.json(
          { error: getErrorMessage("unauthorized", lang) },
          { status: 401 }
        );
    }

    // Verify assignment exists and matches tenant
    const [assignment] = await pool.query(
      `
      SELECT ub.id, b.tenant_id
      FROM user_branches ub
      JOIN branches b ON ub.branch_id = b.id
      WHERE ub.id = ?
      `,
      [userBranchId]
    );

    const record = (assignment as any[])[0];

    if (!record) {
      return NextResponse.json(
        { error: getErrorMessage("userBranchIdNotFound", lang) },
        { status: 404 }
      );
    }

    if (record.tenant_id !== tenant_id) {
      return NextResponse.json(
        { error: getErrorMessage("tenantMismatch", lang) },
        { status: 400 }
      );
    }

    // حذف العنصر فعلياً
    await pool.query(
      `DELETE FROM user_branches WHERE id = ?`,
      [userBranchId]
    );

    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );

  } catch (error) {
    console.error("Unassign user from branch error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
/**
 * GET /api/v1/admin/user-branches/[userBranchId]?tenant_id=1
 *
 * Retrieves a single user branch assignment by its ID.
 * Both the user and branch must belong to the same tenant.
 * Production traffic requires `view_user_branch` permission and tenant access.
 *
 * URL Parameters:
 *   - userBranchId (number, required) : The ID of the user_branch record to retrieve
 *
 * Query Parameters:
 *   - tenant_id (number, required) : Tenant ownership validation
 *
 * Validation:
 *   - Ensures tenant_id and userBranchId are provided and numeric
 *   - Confirms the user_branch record exists
 *   - Confirms the tenant matches the user_branch record
 *
 * Responses:
 *   - 200: { user_branch } : Returns the user_branch details
 *   - 400: { error }       : Missing or invalid tenant_id, or tenant mismatch
 *   - 401: { error }       : Unauthorized (missing permission or tenant access)
 *   - 404: { error }       : user_branch not found
 *   - 500: { error }       : Internal server error
 */
export async function GET(req: NextRequest, { params }: { params:any }) {
  const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";

  try {
    const pool = await dbConnection();
    const tenant_id = Number(new URL(req.url).searchParams.get("tenant_id"));
    const userBranchId = params.userBranchId;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    // Authenticated user
    const user: any = await getUserData(req);

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "view_user_branch");
      if (!hasAccess)
        return NextResponse.json(  { error: getErrorMessage("unauthorized", lang) },
          { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed)
        return NextResponse.json(  { error: getErrorMessage("unauthorized", lang) },
          { status: 401 });
    }

    // Retrieve the user_branch
    const [assignment] = await pool.query(
      `
      SELECT ub.id, ub.user_id, ub.branch_id, u.full_name AS user_name,u.full_name_ar AS user_name_ar, b.name AS branch_name, b.name_ar AS branch_name_ar, b.tenant_id
      FROM user_branches ub
      JOIN users u ON ub.user_id = u.id
      JOIN branches b ON ub.branch_id = b.id
      WHERE ub.id = ?
      `,
      [userBranchId]
    );

    const record = (assignment as any[])[0];

    if (!record) {
        return NextResponse.json({ error: getErrorMessage("userBranchIdNotFound", lang) }, { status: 404 });

    }

    if (record.tenant_id !== tenant_id) {
      return NextResponse.json( { error: getErrorMessage("tenantMismatch", lang) },
        { status: 400 });
    }

    return NextResponse.json({ user_branch: record }, { status: 200 });

  } catch (error) {
    console.error("Get user branch error:", error); 
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}
