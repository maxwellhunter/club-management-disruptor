import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier, type MemberWithTier } from "@/lib/golf-eligibility";
import type { RsvpStatus } from "@club/shared";
import {
  handleGetUpcomingEvents,
  handleRsvpToEvent,
  handleGetMyRsvps,
  handleCancelRsvp,
} from "./handlers";

export interface ChatEventData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string | null;
  capacity: number | null;
  price: number | null;
  rsvp_count: number;
  user_rsvp_status: RsvpStatus | null;
}

export type ChatAttachment =
  | { type: "event_list"; events: ChatEventData[] }
  | { type: "event_cancel"; events: ChatEventData[] };

const SYSTEM_PROMPT = `You are ClubOS Assistant, an AI helper for country club members and staff. You help with:
- Booking tee times, dining reservations, and court times
- Checking account balances and payment history
- Finding information about upcoming events and signing members up
- Looking up member directory information
- Answering general questions about the club

You have access to real club data through tools. When the user asks about events, use the get_upcoming_events tool to fetch current data. When the user wants to sign up or RSVP for an event, use the rsvp_to_event tool. When the user wants to cancel or remove their RSVP, use cancel_rsvp if they name a specific event, or get_my_rsvps if they don't specify which event.

When you use get_upcoming_events, get_my_rsvps, or cancel_rsvp, provide a brief introductory sentence. Do NOT list event details in markdown — the frontend will display interactive event cards automatically.

Be friendly, concise, and helpful. Format responses using clean markdown (bold, lists, etc.) but NEVER use emojis. Keep formatting minimal and readable.`;

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_upcoming_events",
      description:
        "Get upcoming events at the club. Call this when the user asks about events, what's happening, activities, or things to do at the club.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "rsvp_to_event",
      description:
        "Sign the user up (RSVP) for a club event. Call this when the user wants to attend, sign up for, or RSVP to an event.",
      parameters: {
        type: "object",
        properties: {
          event_title: {
            type: "string",
            description: "The title or name of the event to RSVP for",
          },
        },
        required: ["event_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_rsvp",
      description:
        "Cancel the user's RSVP for a specific club event. Call this when the user wants to cancel, remove, or withdraw their RSVP and they mention a specific event name.",
      parameters: {
        type: "object",
        properties: {
          event_title: {
            type: "string",
            description: "The title or name of the event to cancel the RSVP for",
          },
        },
        required: ["event_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_rsvps",
      description:
        "Get all events the user is currently RSVP'd to (attending). Call this when the user wants to see their RSVPs, or wants to cancel an RSVP but doesn't specify which event.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ─── Main Handler ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages } = await request.json();

    if (!process.env.MOONSHOT_API_KEY) {
      return NextResponse.json({
        message:
          "The AI assistant is not yet configured. Please add your MOONSHOT_API_KEY to the environment variables to enable this feature.",
      });
    }

    const client = new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: "https://api.moonshot.ai/v1",
    });

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Resolve member once — reused across tool calls
    let member: MemberWithTier | null = null;

    async function resolveMember() {
      if (!member) {
        const result = await getMemberWithTier(supabase, user!.id);
        member = result?.member ?? null;
      }
      return member;
    }

    // Accumulate structured attachments for the frontend
    const attachments: ChatAttachment[] = [];

    // Tool call loop — keeps going until Kimi gives a final text response
    const MAX_ROUNDS = 3;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: "kimi-k2.5",
        max_tokens: 1024,
        messages: chatMessages,
        tools,
      });

      const choice = response.choices[0]?.message;

      if (!choice?.tool_calls?.length) {
        // No tool calls — final text response
        const result: { message: string; attachments?: ChatAttachment[] } = {
          message: choice?.content ?? "I couldn't generate a response.",
        };
        if (attachments.length > 0) {
          result.attachments = attachments;
        }
        return NextResponse.json(result);
      }

      // Process tool calls
      chatMessages.push(choice);

      for (const toolCall of choice.tool_calls) {
        if (toolCall.type !== "function") continue;
        const m = await resolveMember();
        let toolResult: string;

        if (!m) {
          toolResult = JSON.stringify({ error: "Could not find your member profile." });
        } else if (toolCall.function.name === "get_upcoming_events") {
          const { toolResult: result, events } = await handleGetUpcomingEvents(supabase, m);
          toolResult = result;
          if (events.length > 0) {
            attachments.push({ type: "event_list", events });
          }
        } else if (toolCall.function.name === "rsvp_to_event") {
          const args = JSON.parse(toolCall.function.arguments);
          toolResult = await handleRsvpToEvent(supabase, m, args);
        } else if (toolCall.function.name === "get_my_rsvps") {
          const { toolResult: result, events } = await handleGetMyRsvps(supabase, m);
          toolResult = result;
          if (events.length > 0) {
            attachments.push({ type: "event_cancel", events });
          }
        } else if (toolCall.function.name === "cancel_rsvp") {
          const args = JSON.parse(toolCall.function.arguments);
          const { toolResult: result, events } = await handleCancelRsvp(supabase, m, args);
          toolResult = result;
          if (events.length > 0) {
            attachments.push({ type: "event_cancel", events });
          }
        } else {
          toolResult = JSON.stringify({ error: "Unknown tool." });
        }

        chatMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // If we exhausted rounds, return last available content
    return NextResponse.json({
      message: "I'm having trouble completing that request. Please try again.",
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { message: "Sorry, something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
