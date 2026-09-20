import { NextResponse } from "next/server";

export const runtime = "nodejs";

const OPENAI_BASE_URL =
  process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type ResumeSourceSummary = {
  collectionsWithData: string[];
  tripleCount: number;
  relationshipCount: number;
};

const buildResumePrompt = (resumeSource: {
  personalDetailId: string;
  triples: Array<{ collectionName: string; fieldName: string; value: unknown; documentId: string }>;
  documentsByCollection: Record<string, Array<Record<string, unknown>>>;
}) => {
  return [
    "Create a professional resume in Markdown using only the supplied MongoDB source data.",
    "Do not invent facts, employers, dates, projects, skills, or education details that are not present in the data.",
    "Prefer a clean format with these sections when data exists: Name and Contact, Professional Summary, Experience, Projects, Skills, Certifications, Training, Education.",
    "If data is incomplete, omit the section or explicitly mark it as unavailable.",
    "Source triples:",
    JSON.stringify(resumeSource.triples, null, 2),
    "Source documents grouped by collection:",
    JSON.stringify(resumeSource.documentsByCollection, null, 2),
    `Personal detail object id: ${resumeSource.personalDetailId}`,
  ].join("\n\n");
};

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

    if (!BACKEND_API_URL) {
      return NextResponse.json(
        {
          success: false,
          message: "NEXT_PUBLIC_API_URL is not configured.",
        },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const mode = String(body?.mode || "text").trim();
    const input = String(body?.input || "").trim();
    const personalDetailId = String(body?.personalDetailId || "").trim();

    let userPrompt = input;
    let responseMetadata: Record<string, unknown> = {};
    let sourceSummary: ResumeSourceSummary | null = null;

    if (mode === "resume") {
      if (!personalDetailId) {
        return NextResponse.json(
          {
            success: false,
            message: "personalDetailId is required for resume generation.",
          },
          { status: 400 }
        );
      }

      const resumeSourceResponse = await fetch(
        `${BACKEND_API_URL.replace(/\/$/, "")}/api/resume-source/${encodeURIComponent(personalDetailId)}`,
        {
          cache: "no-store",
        }
      );
      const resumeSourceBody = await resumeSourceResponse.json().catch(() => ({}));

      if (!resumeSourceResponse.ok) {
        return NextResponse.json(
          {
            success: false,
            message:
              resumeSourceBody?.message ||
              `Failed to load resume source data with status ${resumeSourceResponse.status}`,
          },
          { status: resumeSourceResponse.status }
        );
      }

      const resumeSource = resumeSourceBody?.data;
      userPrompt = buildResumePrompt(resumeSource);
      sourceSummary = {
        collectionsWithData: Object.entries(resumeSource?.documentsByCollection || {})
          .filter(([, documents]) => Array.isArray(documents) && documents.length > 0)
          .map(([collectionName]) => collectionName),
        tripleCount: Array.isArray(resumeSource?.triples) ? resumeSource.triples.length : 0,
        relationshipCount: Array.isArray(resumeSource?.relationshipMatches)
          ? resumeSource.relationshipMatches.length
          : 0,
      };
      responseMetadata = {
        personalDetailId,
        sourceSummary,
      };

      console.log(
        `[AI resume request] personalDetailId=${personalDetailId} triples=${sourceSummary.tripleCount}`
      );
    }

    if (!userPrompt) {
      return NextResponse.json(
        {
          success: false,
          message: "Input text is required.",
        },
        { status: 400 }
      );
    }

    console.log(mode === "resume" ? "[AI prompt] Resume generation request prepared" : `[AI prompt] ${userPrompt}`);

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
              mode === "resume"
                ? "You are a senior resume writer. Return a polished Markdown resume grounded strictly in the provided source data. Do not fabricate missing facts."
                : "You are a concise text processing assistant for a resume site. Return a short processed answer.",
          },
          {
            role: "user",
            content: userPrompt,
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
        input: mode === "resume" ? personalDetailId : input,
        output,
        model: OPENAI_MODEL,
        providerBaseUrl: OPENAI_BASE_URL,
        mode,
        ...responseMetadata,
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