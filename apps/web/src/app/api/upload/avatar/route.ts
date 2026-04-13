import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import sharp from "sharp";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB input limit
const OUTPUT_SIZE = 400; // 400x400 max — optimized for avatars
const OUTPUT_QUALITY = 70;

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large (max 5MB)" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }

    // Read and compress — square crop, small output
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const compressed = await sharp(buffer)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: "cover", // crop to square
        position: "centre",
      })
      .jpeg({ quality: OUTPUT_QUALITY, mozjpeg: true })
      .toBuffer();

    // Filename: member_id.jpg (overwrite previous avatar)
    const memberId = result.member.id;
    const filename = `${result.member.club_id}/${memberId}.jpg`;

    const admin = getSupabaseAdmin();
    const { error: uploadError } = await admin.storage
      .from("profile-images")
      .upload(filename, compressed, {
        contentType: "image/jpeg",
        upsert: true, // overwrite existing avatar
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    // Get public URL with cache-bust
    const {
      data: { publicUrl },
    } = admin.storage.from("profile-images").getPublicUrl(filename);

    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    // Auto-update the member record
    await admin
      .from("members")
      .update({ avatar_url: avatarUrl })
      .eq("id", memberId);

    return NextResponse.json({
      url: avatarUrl,
      size: compressed.length,
      originalSize: buffer.length,
    });
  } catch (error) {
    console.error("Avatar upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
