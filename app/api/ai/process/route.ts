import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_BASE_URL =
  process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

export async function POST(request: Request) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          message:
            "OPENAI_API_KEY is not configured. Set OPENAI_API_KEY plus OPENAI_COMPATIBLE_BASE_URL/OPENAI_MODEL for a free OpenAI-compatible provider.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const input = String(body?.input || "").trim();

    if (!input) {
      return NextResponse.json(
        {
          success: false,
          message: "Input text is required.",
        },
        { status: 400 }
      );
    }

    console.log(`[AI prompt] ${input}`);

    const upstreamResponse = await fetch(`${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a concise text processing assistant for a resume site. Return a short processed answer.",
          },
          {
            role: "user",
            content: input,
          },
        ],
      }),
      cache: "no-store",
    });

    const upstreamBody = await upstreamResponse.json().catch(() => ({}));
    if (!upstreamResponse.ok) {
      const message =
        upstreamBody?.error?.message ||
        upstreamBody?.message ||
        `Upstream AI request failed with status ${upstreamResponse.status}`;

      console.error(`[AI error] ${message}`);

      return NextResponse.json(
        {
          success: false,
          message,
          upstream: upstreamBody,
        },
        { status: upstreamResponse.status }
      );
    }

    const output =
      upstreamBody?.choices?.[0]?.message?.content ||
      upstreamBody?.choices?.[0]?.text ||
      "";

    console.log(`[AI response] ${output}`);

    return NextResponse.json({
      success: true,
      data: {
        input,
        output,
        model: OPENAI_MODEL,
        providerBaseUrl: OPENAI_BASE_URL,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected AI processing error";
    console.error(`[AI fatal] ${message}`);

    return NextResponse.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}