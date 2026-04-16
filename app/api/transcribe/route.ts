import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Transcription not configured." }, { status: 500 });
  }

  const formData = await req.formData();
  const audio = formData.get("audio") as Blob | null;
  const lang = (formData.get("lang") as string | null) ?? "en";

  if (!audio) {
    return NextResponse.json({ error: "No audio provided." }, { status: 400 });
  }

  const groqForm = new FormData();
  groqForm.append("file", audio, "audio.webm");
  groqForm.append("model", "whisper-large-v3-turbo");
  groqForm.append("language", lang.split("-")[0]); // "en-US" → "en"
  groqForm.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqForm,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ transcript: data.text ?? "" });
}