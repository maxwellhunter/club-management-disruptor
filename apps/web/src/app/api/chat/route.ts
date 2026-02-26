import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are ClubOS Assistant, an AI helper for country club members and staff. You help with:
- Booking tee times, dining reservations, and court times
- Checking account balances and payment history
- Finding information about upcoming events
- Looking up member directory information
- Answering general questions about the club

Be friendly, concise, and helpful. If you don't have access to specific data yet (the system is being set up), let the user know politely and suggest what will be available soon.`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = await request.json();

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        message:
          "The AI assistant is not yet configured. Please add your ANTHROPIC_API_KEY to the environment variables to enable this feature.",
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages.map(
        (msg: { role: string; content: string }) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })
      ),
    });

    const textBlock = response.content.find((block) => block.type === "text");

    return NextResponse.json({
      message: textBlock?.text ?? "I couldn't generate a response.",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { message: "Sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
