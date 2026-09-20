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

type BackendResumeSource = {
  personalDetailId: string;
  collectionsExamined: string[];
  availableCollections: string[];
  missingCollections: string[];
  relationshipMatches: Array<{
    collectionName: string;
    documentId: string;
    fieldName: string;
    matchedId: string;
  }>;
  triples: Array<{
    collectionName: string;
    fieldName: string;
    value: unknown;
    documentId: string;
  }>;
  documentsByCollection: Record<string, Array<Record<string, unknown>>>;
};

const RESUME_COLLECTIONS = [
  "Academic_History",
  "All_Technologies_Aware_of",
  "Company_Details",
  "Personal_Details_Table",
  "Project_Per_Company_details",
  "Tech_Certification_Persued",
  "Tech_Trainings_Given",
  "Tech_Trainings_Recieved",
  "Tech_Vendor_Reference_Table",
  "Technolologies_Per_Project_Per_Company_Details",
];

const buildResumePrompt = (resumeSource: {
  personalDetailId: string;
  triples: Array<{ collectionName: string; fieldName: string; value: unknown; documentId: string }>;
}) => {
  return [
    "Please create a Resume using the below feilds in Json format.",
    "Return only valid, well-formatted HTML for the resume. Do not wrap the response in markdown, code fences, or explanations.",
    "Use semantic HTML sections and include a small amount of CSS styling inline or inside a style block so the resume is readable.",
    JSON.stringify(
      {
        personalDetailId: resumeSource.personalDetailId,
        triples: resumeSource.triples,
      },
      null,
      2
    ),
  ].join("\n\n");
};

const stripCodeFences = (value: string) => {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```(?:html)?\s*([\s\S]*?)```$/i);

  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed;
};

const serializeSourceValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (Array.isArray(value)) {
    return value.map(serializeSourceValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, serializeSourceValue(nested)])
    );
  }

  return value;
};

const isObjectIdLike = (value: unknown) => {
  return typeof value === "string" && /^[a-fA-F0-9]{24}$/.test(value);
};

const collectReferenceValues = (value: unknown, accumulator = new Set<string>()) => {
  if (value === null || value === undefined) {
    return accumulator;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectReferenceValues(item, accumulator));
    return accumulator;
  }

  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((nested) => collectReferenceValues(nested, accumulator));
    return accumulator;
  }

  if (isObjectIdLike(value)) {
    accumulator.add(String(value));
  }

  return accumulator;
};

const buildResumeSourceFromDocuments = async (personalDetailId: string): Promise<BackendResumeSource> => {
  const metadataResponse = await fetch(`${BACKEND_API_URL.replace(/\/$/, "")}/api/documents/metadata`, {
    cache: "no-store",
  });
  const metadataBody = await metadataResponse.json().catch(() => ({}));

  if (!metadataResponse.ok) {
    throw new Error(
      metadataBody?.message || `Failed to load document metadata with status ${metadataResponse.status}`
    );
  }

  const collections = Array.isArray(metadataBody?.data?.collections)
    ? metadataBody.data.collections.filter((collectionName: unknown) =>
        RESUME_COLLECTIONS.includes(String(collectionName))
      )
    : RESUME_COLLECTIONS;

  const documentsByCollection: Record<string, Array<Record<string, unknown>>> = Object.fromEntries(
    RESUME_COLLECTIONS.map((collectionName) => [collectionName, []])
  );

  const relationshipMatches: BackendResumeSource["relationshipMatches"] = [];
  const knownIds = new Set<string>([personalDetailId]);
  const includedKeys = new Set<string>();

  for (const collectionName of collections) {
    const response = await fetch(
      `${BACKEND_API_URL.replace(/\/$/, "")}/api/documents/${encodeURIComponent(collectionName)}?limit=100`,
      { cache: "no-store" }
    );
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      continue;
    }

    const documents = Array.isArray(body?.data?.documents) ? body.data.documents : [];
    documentsByCollection[collectionName] = documents;

    for (const document of documents) {
      const documentId = String(document?._id || "");
      const documentRefs = collectReferenceValues(document);
      const matchesKnownId = Array.from(documentRefs).some((referenceId) => knownIds.has(referenceId));

      if (collectionName === "Personal_Details_Table" && documentId === personalDetailId) {
        includedKeys.add(`${collectionName}:${documentId}`);
        collectReferenceValues(document, knownIds);
        continue;
      }

      if (matchesKnownId) {
        includedKeys.add(`${collectionName}:${documentId}`);
        relationshipMatches.push({
          collectionName,
          documentId,
          fieldName: "reference",
          matchedId: personalDetailId,
        });
        collectReferenceValues(document, knownIds);
      }
    }
  }

  const triples: BackendResumeSource["triples"] = [];
  Object.entries(documentsByCollection).forEach(([collectionName, documents]) => {
    documents.forEach((document) => {
      Object.entries(document).forEach(([fieldName, value]) => {
        if (fieldName === "_id") {
          return;
        }

        triples.push({
          collectionName,
          fieldName,
          value: serializeSourceValue(value),
          documentId: String(document._id || ""),
        });
      });
    });
  });

  const availableCollections = RESUME_COLLECTIONS.filter((collectionName) => documentsByCollection[collectionName].length > 0);
  const missingCollections = RESUME_COLLECTIONS.filter((collectionName) => documentsByCollection[collectionName].length === 0);

  return {
    personalDetailId,
    collectionsExamined: RESUME_COLLECTIONS,
    availableCollections,
    missingCollections,
    relationshipMatches,
    triples,
    documentsByCollection,
  };
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

      let resumeSource: BackendResumeSource;
      try {
        const resumeSourceResponse = await fetch(
          `${BACKEND_API_URL.replace(/\/$/, "")}/api/resume-source/${encodeURIComponent(personalDetailId)}`,
          {
            cache: "no-store",
          }
        );
        const resumeSourceBody = await resumeSourceResponse.json().catch(() => ({}));

        if (!resumeSourceResponse.ok) {
          throw new Error(
            resumeSourceBody?.message ||
              `Failed to load resume source data with status ${resumeSourceResponse.status}`
          );
        }

        resumeSource = resumeSourceBody?.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load resume source data";
        console.log(`[AI resume fallback] ${message}. Falling back to document aggregation.`);
        resumeSource = await buildResumeSourceFromDocuments(personalDetailId);
      }

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

    const htmlOutput = stripCodeFences(String(output));

    console.log(`[AI response] ${htmlOutput}`);

    return NextResponse.json({
      success: true,
      data: {
        input: mode === "resume" ? personalDetailId : input,
        output: htmlOutput,
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