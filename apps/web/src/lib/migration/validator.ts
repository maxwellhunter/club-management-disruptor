import type { ImportEntityType, ImportError } from "@club/shared";
import { TARGET_FIELDS } from "./field-mapper";

/**
 * Validate imported rows against target field requirements.
 * Returns per-row errors for preview display.
 */
export function validateRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  entityType: ImportEntityType,
): { validRows: Record<string, string>[]; errors: ImportError[] } {
  const requiredFields = TARGET_FIELDS[entityType]
    .filter((f) => f.required)
    .map((f) => f.field);

  // Build reverse mapping: target_field -> source_column
  const reverseMap = new Map<string, string>();
  for (const [source, target] of Object.entries(mapping)) {
    reverseMap.set(target, source);
  }

  const errors: ImportError[] = [];
  const validRows: Record<string, string>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let rowValid = true;

    // Check required fields
    for (const field of requiredFields) {
      const sourceCol = reverseMap.get(field);
      if (!sourceCol) {
        errors.push({
          row: i + 1,
          field,
          value: "",
          message: `Required field "${field}" is not mapped to any column`,
        });
        rowValid = false;
        continue;
      }
      const value = row[sourceCol]?.trim();
      if (!value) {
        errors.push({
          row: i + 1,
          field,
          value: "",
          message: `Required field "${field}" is empty`,
        });
        rowValid = false;
      }
    }

    // Validate email format if present
    const emailCol = reverseMap.get("email") || reverseMap.get("member_email");
    if (emailCol && row[emailCol]) {
      const email = row[emailCol].trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({
          row: i + 1,
          field: "email",
          value: email,
          message: `Invalid email format: "${email}"`,
        });
        rowValid = false;
      }
    }

    // Validate amount fields
    const amountCol = reverseMap.get("amount");
    if (amountCol && row[amountCol]) {
      const raw = row[amountCol].replace(/[$,]/g, "").trim();
      if (raw && isNaN(Number(raw))) {
        errors.push({
          row: i + 1,
          field: "amount",
          value: row[amountCol],
          message: `Invalid amount: "${row[amountCol]}"`,
        });
        rowValid = false;
      }
    }

    if (rowValid) {
      validRows.push(row);
    }
  }

  return { validRows, errors };
}

/**
 * Transform a validated row into a ClubOS record using the field mapping.
 */
export function transformRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [sourceCol, targetField] of Object.entries(mapping)) {
    const value = row[sourceCol]?.trim();
    if (value !== undefined && value !== "") {
      result[targetField] = value;
    }
  }
  return result;
}
