import { NextRequest, NextResponse } from "next/server";
import { dbConnection } from "../../../functions/db";
import { validateFields } from "../../../functions/validation";
import { hasPermission, getUserData, hasTenantAccess } from "../../../functions/permissions";

const errorMessages = {
  en: {
    tenantRequired: "Tenant ID is required.",
    skuExists: "SKU already exists.",
    unauthorized: "Unauthorized access.",
    missingProductId: "Product ID are required.",
    invalidProductIds: "Invalid product_ids payload.",
    noProductFound: "No product found.",
    updatedSuccess: "Product updated successfully.",
    serverError: "Internal server error.",
    deletedSuccess:"Product deleted successfully"
  },
  ar: {
    tenantRequired: "معرف المنظمة مطلوب.",
    skuExists: "الرمز SKU موجود مسبقاً.",
    unauthorized: "دخول غير مصرح به.",
    missingProductId: "معرف المنتج مطلوب.",
    invalidProductIds: "قائمة المنتجات غير صالحة.",
    noProductFound: "لم يتم العثور على المنتج .",
    updatedSuccess: "تم تعديل المنتج بنجاح.",
    serverError: "خطأ في الخادم الداخلي.",
    deletedSuccess:"تم حذف المنتج بنجاح"
  },
};

function getErrorMessage(
  key: keyof typeof errorMessages["en"],
  lang: "en" | "ar" = "en"
) {
  return errorMessages[lang][key] || errorMessages["en"][key];
}

const requiredFieldLabels = {
  tenant_id: { en: "Tenant", ar: "المنظمة" },
  sku: { en: "SKU", ar: "رمز SKU" },
  product_name: { en: "Product Name", ar: "اسم المنتج" },
  product_name_ar: { en: "Product Name (Arabic)", ar: "اسم المنتج بالعربية" },
  category: { en: "Category", ar: "الفئة" },
  category_ar: { en: "Category (Arabic)", ar: "الفئة بالعربية" },
  barcode: { en: "Barcode", ar: "الباركود" },
  base_price: { en: "Base Price", ar: "السعر الأساسي" },
};

/**
 * PUT /api/v1/admin/products/[productId]
 *
 * Updates an existing product for a tenant. Only the provided fields in the request body will be updated.
 *
 * Request Headers:
 *   - accept-language (optional): "en" | "ar" for localized responses
 *
 * Path Parameters:
 *   - productId (number, required) : ID of the product to update
 *
 * Request Body:
 *   - tenant_id (number, required)         : Tenant/organization ID the product belongs to
 *   - sku (string, required)               : Product SKU, must be unique within the tenant
 *   - barcode (string, optional)           : Product barcode
 *   - product_name (string, required)      : Product name in English
 *   - product_name_ar (string, optional)   : Product name in Arabic
 *   - category (string, required)          : Product category in English
 *   - category_ar (string, optional)       : Product category in Arabic
 *   - base_price (number, required)        : Base price of the product
 *
 * Responses:
 *   - 200: { message }                      : Product updated successfully
 *   - 400: { error }                        : Missing or invalid fields
 *   - 401: { error }                        : Permission or tenant access denied
 *   - 404: { error }                        : Product not found
 *   - 409: { error }                        : SKU already exists for another product
 *   - 500: { error }                        : Internal server error
 *
 * Notes:
 *   - Only the fields provided in the request body will be updated.
 *   - Optional fields not provided will remain unchanged.
 *   - Supports localized messages in English or Arabic.
 */

export async function PUT(req: NextRequest, { params }: any): Promise<NextResponse> {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const user: any = await getUserData(req);

    const productId = params.productId;
    if (!productId) {
      return NextResponse.json({ error: getErrorMessage("missingProductId", lang) }, { status: 400 });
    }

    const payload = await req.json();
    const { tenant_id, sku, barcode, product_name, product_name_ar, category, category_ar, base_price } = payload;

    if (!tenant_id) {
      return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 400 });
    }

    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "edit_product");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Validation rules

       const rules: any = {
         tenant_id: [
           { required: true, label: requiredFieldLabels.tenant_id[lang] },
           { type: "number", label: requiredFieldLabels.tenant_id[lang] },
         ],
         sku: [
           { required: true, label: requiredFieldLabels.sku[lang] },
           { minLength: 1, label: requiredFieldLabels.sku[lang] },
         ],
         product_name: [
           { required: true, label: requiredFieldLabels.product_name[lang] },
           { minLength: 2, label: requiredFieldLabels.product_name[lang] },
         ],
         product_name_ar: [
           { required: true, label: requiredFieldLabels.product_name_ar[lang] },
           { minLength: 2, label: requiredFieldLabels.product_name_ar[lang] },
         ],
         category: [
           { required: true, label: requiredFieldLabels.category[lang] },
           { minLength: 2, label: requiredFieldLabels.category[lang] },
         ],
         category_ar: [
           { required: true, label: requiredFieldLabels.category_ar[lang] },
           { minLength: 2, label: requiredFieldLabels.category_ar[lang] },
         ],
         barcode: [
           { required: true, label: requiredFieldLabels.barcode[lang] },
           { minLength: 2, label: requiredFieldLabels.barcode[lang] },
         ],
         base_price: [
           { required: true, label: requiredFieldLabels.base_price[lang] },
           { type: "number", label: requiredFieldLabels.base_price[lang] },
         ],
       };
   
       const { valid, errors } = validateFields(payload, rules, lang);
       if (!valid) {
         return NextResponse.json({ error: errors }, { status: 400 });
       }
   

    const pool = await dbConnection();

    // Check if product exists
    const [existingProduct] = await pool.query(
      `SELECT * FROM products WHERE id = ? AND tenant_id = ?`,
      [productId, tenant_id]
    );
    if (!(existingProduct as any[]).length) {
      return NextResponse.json({ error: getErrorMessage("noProductFound", lang) }, { status: 404 });
    }

    // Check SKU uniqueness
    if (sku) {
      const [conflict] = await pool.query(
        `SELECT * FROM products WHERE sku = ? AND id != ? AND tenant_id = ?`,
        [sku, productId, tenant_id]
      );
      if ((conflict as any[]).length > 0) {
        return NextResponse.json({ error: getErrorMessage("skuExists", lang) }, { status: 409 });
      }
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    if (sku) { fields.push("sku = ?"); values.push(sku); }
    if (barcode) { fields.push("barcode = ?"); values.push(barcode); }
    if (product_name) { fields.push("product_name = ?"); values.push(product_name); }
    if (product_name_ar) { fields.push("product_name_ar = ?"); values.push(product_name_ar); }
    if (category) { fields.push("category = ?"); values.push(category); }
    if (category_ar) { fields.push("category_ar = ?"); values.push(category_ar); }
    if (base_price !== undefined) { fields.push("base_price = ?"); values.push(base_price); }

    if (fields.length > 0) {
      await pool.query(
        `UPDATE products SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
        [...values, productId, tenant_id]
      );
    }

    return NextResponse.json({ message: getErrorMessage("updatedSuccess", lang) }, { status: 200 });

  } catch (error) {
    console.error("Edit product error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}


/**
 * GET /api/v1/admin/products/[productId]
 *
 * Returns a single  product for a tenant. Production traffic must pass `view_products`
 * and tenant access checks.
 *
 * Path Parameters:
 *   - productId (number, required)
 *
 * Query Parameters:
 *   - tenant_id (number, required in production)
 *
 * Responses:
 *   - 200: product object
 *   - 400: { error } : productId or tenant_id missing
 *   - 401: { error } : Permission or tenant access denied
 *   - 404: { error } : Product not found 
 *   - 500: { error } : Internal server error
 *
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
      const hasAccess = await hasPermission(user, "view_products");
      if (!hasAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const tenantAccess = await hasTenantAccess(user, tenant_id);
      if (!tenantAccess)
        return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    const productId = params.productId;
    if (!productId) {
      return NextResponse.json({ error: getErrorMessage("missingProductId", lang) }, { status: 400 });
    }

    const pool = await dbConnection();

    const [rows] = await pool.query(
      `SELECT id, tenant_id, sku, barcode, product_name, product_name_ar, category, category_ar, base_price, created_at
       FROM products
       WHERE id = ? AND tenant_id = ?`,
      [productId, tenant_id]
    );

    const product = (rows as any[])[0];
    if (!product) {
      return NextResponse.json({ error: getErrorMessage("noProductFound", lang) }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    console.error("GET product by ID error:", error);
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    return NextResponse.json({ error: getErrorMessage("serverError", lang) }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/admin/products/[productId]
 *
 * Permanently deletes a single product. Production traffic must pass `delete_product`
 * and confirm tenant access.
 *
 * Path Parameters:
 *   - productId (number, required)
 *
 * Request Body:
 *   - tenant_id (number, required)
 *
 * Responses:
 *   - 200: { message }  : Product deleted successfully
 *   - 400: { error }    : tenant_id or productId missing
 *   - 401: { error }    : Permission or tenant access denied
 *   - 404: { error }    : Product not found in tenant
 *   - 500: { error }    : Internal server error
 */
export async function DELETE(req: NextRequest, { params }: any) {
  try {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    const pool = await dbConnection();
    const { tenant_id } = await req.json();
    const product_id = params.productId;

    if (!tenant_id || !product_id) {
      return NextResponse.json(
        { error: getErrorMessage("unauthorized", lang) },
        { status: 400 }
      );
    }

    const user: any = await getUserData(req);
    if (process.env.NODE_ENV === "production") {
      const hasAccess = await hasPermission(user, "delete_product");
      if (!hasAccess) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });

      const allowed = await hasTenantAccess(user, tenant_id);
      if (!allowed) return NextResponse.json({ error: getErrorMessage("unauthorized", lang) }, { status: 401 });
    }

    // Ensure target product exists
    const [targetProducts] = await pool.query(
      `SELECT id FROM products WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [product_id, tenant_id]
    );

    const productsArr = targetProducts as any[];
    if (!productsArr.length) {
      return NextResponse.json({ error: getErrorMessage("noProductFound", lang) }, { status: 404 });
    }

    await pool.query(
      `DELETE FROM products WHERE id = ? AND tenant_id = ?`,
      [product_id, tenant_id]
    );

    return NextResponse.json(
      { message: getErrorMessage("deletedSuccess", lang) },
      { status: 200 }
    );
  } catch (error) {
    const lang = req.headers.get("accept-language")?.startsWith("ar") ? "ar" : "en";
    console.error("DELETE product error:", error);
    return NextResponse.json(
      { error: getErrorMessage("serverError", lang) },
      { status: 500 }
    );
  }
}

