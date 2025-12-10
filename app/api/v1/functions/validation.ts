type PasswordStrengthRule = {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSymbols?: boolean;
};

export type ValidationRule = {
    label: string;
    required?: boolean;
    type?: "string" | "email" | "number" | "boolean" | "array";
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    phone?: boolean;
    passwordStrength?: boolean;
    custom?: (value: any) => boolean;
    customMessage?: { en: string; ar: string };
};

const messages = {
    en: {
        required: (label: string) => `${label} is required.`,
        email: (label: string) => `${label} must be a valid email.`,
        number: (label: string) => `${label} must be a number.`,
        boolean: (label: string) => `${label} must be true or false.`,
        array: (label: string) => `${label} must be an array.`,
        min: (label: string, len: number) => `${label} must be at least ${len} characters.`,
        max: (label: string, len: number) => `${label} must be at most ${len} characters.`,
        pattern: (label: string) => `${label} format is invalid.`,
        phone: (label: string) => `${label} must be a valid phone number.`,
        password: (label: string, details: string[]) =>
            `${label} must include: ${details.join(", ")}.`,
    },
    ar: {
        required: (label: string) => `${label} مطلوب.`,
        email: (label: string) => `${label} يجب أن يكون بريدًا إلكترونيًا صالحًا.`,
        number: (label: string) => `${label} يجب أن يكون رقمًا.`,
        boolean: (label: string) => `${label} يجب أن يكون صحيحًا أو خطأ.`,
        array: (label: string) => `${label} يجب أن يكون مصفوفة.`,
        min: (label: string, len: number) => `${label} يجب ألا يقل عن ${len} أحرف.`,
        max: (label: string, len: number) => `${label} يجب ألا يزيد عن ${len} أحرف.`,
        pattern: (label: string) => `${label} غير صالح.`,
        phone: (label: string) => `${label} يجب أن يكون رقم هاتف صالح.`,
        password: (label: string, details: string[]) =>
            `${label} يجب أن يحتوي على: ${details.join("، ")}.`,
    },
};

function getPasswordErrors(value: string, rule: PasswordStrengthRule, lang: "en" | "ar") {
    const details: string[] = [];
    if (rule.minLength && value.length < rule.minLength) {
        details.push(lang === "ar" ? `على الأقل ${rule.minLength} أحرف` : `minimum ${rule.minLength} characters`);
    }
    if (rule.requireUppercase && !/[A-Z]/.test(value)) {
        details.push(lang === "ar" ? "حرف كبير" : "an uppercase letter");
    }
    if (rule.requireLowercase && !/[a-z]/.test(value)) {
        details.push(lang === "ar" ? "حرف صغير" : "a lowercase letter");
    }
    if (rule.requireNumbers && !/\d/.test(value)) {
        details.push(lang === "ar" ? "رقم" : "a number");
    }
    if (rule.requireSymbols && !/[\W_]/.test(value)) {
        details.push(lang === "ar" ? "رمز خاص" : "a special character");
    }
    return details;
}

export function validateFields(
    data: Record<string, any>,
    rules: Record<string, ValidationRule[]>,
    lang: "en" | "ar" = "en"
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const isEmpty = (val: any) =>
        val === undefined ||
        val === null ||
        val === "" ||
        (Array.isArray(val) && val.length === 0);

    const getLength = (val: any) =>
        Array.isArray(val) ? val.length : String(val).length;

    Object.entries(rules).forEach(([field, fieldRules]) => {
        const value = data[field];
        fieldRules.forEach((rule) => {
            const label = rule.label;
            if (rule.required && isEmpty(value)) {
                errors.push(messages[lang].required(label));
                return;
            }
            if (isEmpty(value)) return;

            if (rule.type === "string" && typeof value !== "string") {
                errors.push(messages[lang].pattern(label));
            }
            if (rule.type === "email" && !/^\S+@\S+\.\S+$/.test(String(value))) {
                errors.push(messages[lang].email(label));
            }
            if (rule.type === "number" && isNaN(Number(value))) {
                errors.push(messages[lang].number(label));
            }
            if (rule.type === "boolean" && typeof value !== "boolean") {
                errors.push(messages[lang].boolean(label));
            }
            if (rule.type === "array" && !Array.isArray(value)) {
                errors.push(messages[lang].array(label));
            }
            if (rule.minLength && getLength(value) < rule.minLength) {
                errors.push(messages[lang].min(label, rule.minLength));
            }
            if (rule.maxLength && getLength(value) > rule.maxLength) {
                errors.push(messages[lang].max(label, rule.maxLength));
            }
            if (rule.pattern && typeof value === "string" && !rule.pattern.test(String(value))) {
                errors.push(messages[lang].pattern(label));
            }
            if (rule.phone && typeof value === "string" && !/^\+?\d{8,15}$/.test(String(value))) {
                errors.push(messages[lang].phone(label));
            }
            if (rule.passwordStrength && typeof value === "string") {
                const strengthRule =
                    typeof rule.passwordStrength === "boolean"
                        ? { minLength: 8, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSymbols: true }
                        : rule.passwordStrength;

                const passwordErrors = getPasswordErrors(value, strengthRule, lang);
                if (passwordErrors.length > 0) {
                    errors.push(messages[lang].password(label, passwordErrors));
                }
            }
            if (rule.custom && !rule.custom(value)) {
                errors.push(
                    rule.customMessage?.[lang] ||
                    rule.customMessage?.en ||
                    messages[lang].pattern(label)
                );
            }
        });
    });

    return { valid: errors.length === 0, errors };
}