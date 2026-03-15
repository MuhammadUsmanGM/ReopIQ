// app/api/chat/route.ts

import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { retrieveChunks, buildContext, buildSystemPrompt } from "@/lib/rag";
import { SYSTEM_PROMPT } from "@/lib/prompts";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { repo_id, message, history } = await req.json();

    if (!repo_id || !message) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Retrieve Context
    const chunks = await retrieveChunks(repo_id, message);
    const context = buildContext(chunks);
    const sources = Array.from(new Set(chunks.map(c => c.filePath)));

    // 2. Initialize Gemini
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY not set");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: `${SYSTEM_PROMPT}\n\n<retrieved_context>\n${context}\n</retrieved_context>`
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send sources immediately
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
          console.error("Chat Stream Error:", error);
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
    console.error("Chat API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
