import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import sharp from "sharp";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB input limit
const OUTPUT_WIDTH = 1200; // max width px
const OUTPUT_QUALITY = 75; // JPEG quality — good balance of size vs clarity

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const bucket = (formData.get("bucket") as string) || "event-images";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 10MB)" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read the file and compress with sharp
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressed = await sharp(buffer)
      .resize(OUTPUT_WIDTH, undefined, {
        withoutEnlargement: true, // don't upscale small images
        fit: "inside",
      })
      .jpeg({ quality: OUTPUT_QUALITY, mozjpeg: true })
      .toBuffer();

    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `${result.member.club_id}/${timestamp}.jpg`;

    // Upload to Supabase Storage
    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(filename, compressed, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = admin.storage.from(bucket).getPublicUrl(filename);

    return NextResponse.json({
      url: publicUrl,
      size: compressed.length,
      originalSize: buffer.length,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
