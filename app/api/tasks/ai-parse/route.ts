import { withAuth } from "@/lib/api-helpers";
import { apiError, apiResponse } from "@/lib/api-helpers";
import { hasRole } from "@/lib/rbac";

type UserContext = {
  _id: string;
  name: string;
  username?: string;
  role: string;
  departmentPath: string;
};

type AiParseBody = {
  prompt?: unknown;
  users?: unknown;
  departmentPath?: unknown;
  today?: unknown;
};

type AiParseResult = {
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  assigneeId: string | null;
  steps: string[];
  warnings: string[];
};

export const POST = withAuth(async (req, user) => {
  if (!hasRole(user.role, "manager")) {
    return apiError("Forbidden", 403);
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return apiError("AI not configured.", 500);
  }

  const body = (await req.json()) as AiParseBody;

  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return apiError("prompt is required", 400);
  }
  if (!Array.isArray(body.users)) {
    return apiError("users is required", 400);
  }

  const users = body.users as UserContext[];
  const departmentPath = typeof body.departmentPath === "string" ? body.departmentPath : "";
  const today = typeof body.today === "string" ? body.today : new Date().toISOString().slice(0, 10);

  const systemPrompt = `You are a task management assistant. Extract task details from the user's description and return a JSON object.

Today's date: ${today}
Current department: ${departmentPath || "unknown"}

Available team members (pick assignee from this list only):
${JSON.stringify(users, null, 2)}

Return ONLY a valid JSON object with this exact shape:
{
  "title": "concise task title (required)",
  "description": "detailed description or null",
  "priority": "low" | "medium" | "high" | "urgent",
  "dueDate": "YYYY-MM-DD or null",
  "assigneeId": "the _id value from the team member list, or null",
  "steps": ["actionable step 1", "actionable step 2"],
  "warnings": ["any assumptions or issues"]
}

Rules:
- title must be present and concise (under 80 chars)
- Pick assignee by matching role to task type and any name/username hints in the description; return null if unclear
- steps should be concrete actionable items; return empty array [] if none are implied
- priority defaults to "medium" if not specified
- Resolve relative dates (today, tomorrow, next Friday, this week) against today's date
- Return null for optional fields you cannot determine`;

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body.prompt.trim() },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    }),
  });

  if (!groqRes.ok) {
    const text = await groqRes.text();
    return apiError(`AI request failed: ${text}`, 502);
  }

  const groqJson = (await groqRes.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const raw = groqJson.choices?.[0]?.message?.content ?? "";

  let parsed: AiParseResult;
  try {
    parsed = JSON.parse(raw) as AiParseResult;
  } catch {
    return apiError("AI returned invalid JSON.", 502);
  }

  // Sanitize
  const result: AiParseResult = {
    title: typeof parsed.title === "string" ? parsed.title.trim() : "",
    description: typeof parsed.description === "string" ? parsed.description.trim() : null,
    priority: ["low", "medium", "high", "urgent"].includes(parsed.priority as string)
      ? parsed.priority
      : "medium",
    dueDate:
      typeof parsed.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)
        ? parsed.dueDate
        : null,
    assigneeId:
      typeof parsed.assigneeId === "string" &&
      users.some((u) => u._id === parsed.assigneeId)
        ? parsed.assigneeId
        : null,
    steps: Array.isArray(parsed.steps)
      ? parsed.steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [],
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };

  if (!result.title) {
    return apiError("AI could not extract a task title.", 422);
  }

  return apiResponse(result);
});
