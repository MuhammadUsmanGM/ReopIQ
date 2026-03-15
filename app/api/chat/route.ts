// app/api/chat/route.ts

import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveHybrid, buildContext } from "@/lib/rag";
import { buildHybridPrompt } from "@/lib/prompts";
import { GEMINI_MODEL } from "@/lib/constants";
import { getGoogleApiKey } from "@/lib/env";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { repo_id, message, history } = await req.json();

    if (!repo_id || !message) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Hybrid retrieval — full context for small repos, RAG for large
    const { chunks, fileTree, mode, sources } = await retrieveHybrid(repo_id, message);
    const context = buildContext(chunks);

    // 2. Build mode-aware prompt
    const systemPrompt = buildHybridPrompt(context, fileTree, mode);

    // 3. Initialize Gemini
    const genAI = new GoogleGenerativeAI(getGoogleApiKey());
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: systemPrompt,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send sources + mode info immediately
          sendEvent("sources", sources);

          // Prepare history for Gemini
          const chat = model.startChat({
            history: history?.map((msg: any) => ({
              role: msg.role === "user" ? "user" : "model",
              parts: [{ text: msg.content }],
            })) || [],
          });

          const result = await chat.sendMessageStream(message);

          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            sendEvent("message", chunkText);
          }

          sendEvent("done", "[DONE]");
          controller.close();
        } catch (error: any) {
          sendEvent("error", error.message || "An error occurred during chat");
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
