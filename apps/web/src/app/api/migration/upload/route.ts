import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { ImportSourceSystem, ImportEntityType } from "@club/shared";
import { parseCSV } from "@/lib/migration/csv-parser";
import { suggestMapping } from "@/lib/migration/field-mapper";
import { validateRows } from "@/lib/migration/validator";

/**
 * POST /api/migration/upload — Upload a CSV file for import preview.
 * Parses the CSV, auto-detects field mapping, validates rows, and returns a preview.
 * Admin only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceSystem = formData.get("source_system") as ImportSourceSystem | null;
    const entityType = formData.get("entity_type") as ImportEntityType | null;

    if (!file || !sourceSystem || !entityType) {
      return NextResponse.json(
        { error: "Missing file, source_system, or entity_type" },
        { status: 400 },
      );
    }

    // Read file content
    const content = await file.text();
    if (!content.trim()) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Parse CSV
    const parsed = parseCSV(content);
    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: "No headers found in CSV" }, { status: 400 });
    }
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in CSV" }, { status: 400 });
    }

    // Auto-detect field mapping
    const suggestedMapping = suggestMapping(parsed.headers, entityType, sourceSystem);

    // Validate rows with suggested mapping
    const { validRows, errors } = validateRows(parsed.rows, suggestedMapping, entityType);

    // Create import batch record
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        club_id: result.member.club_id,
        source_system: sourceSystem,
        entity_type: entityType,
        status: "preview",
        file_name: file.name,
        total_rows: parsed.rows.length,
        valid_rows: validRows.length,
        error_rows: errors.length > 0 ? parsed.rows.length - validRows.length : 0,
        field_mapping: suggestedMapping,
        errors: errors.slice(0, 100), // Cap errors stored
        imported_by: result.member.id,
      })
      .select()
      .single();

    if (batchError) throw batchError;

    return NextResponse.json({
      batch_id: batch.id,
      total_rows: parsed.rows.length,
      valid_rows: validRows.length,
      error_rows: parsed.rows.length - validRows.length,
      errors: errors.slice(0, 50), // Return first 50 errors
      sample_rows: parsed.rows.slice(0, 5), // First 5 rows for preview
      detected_columns: parsed.headers,
      suggested_mapping: suggestedMapping,
    });
  } catch (error) {
    console.error("Migration upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
