import { callLocalOpenAINonStream, resolveLocalOpenAIBaseUrl } from "./local-openai-provider.js";
import { invokeGroqNonStream, type GroqMessage, type GroqResponse } from "./groq.js";

export async function invokePlanningModel(params: { model?: string; messages: GroqMessage[]; maxTokens: number; temperature: number }): Promise<GroqResponse> {
  const baseUrl = resolveLocalOpenAIBaseUrl(process.env.LOCAL_OPENAI_BASE_URL);
  const preferred = (process.env.LOCAL_PLANNER_MODEL || process.env.LOCAL_AGENT_MODEL || "qwen/qwen3-8b").trim();
  try {
    const response = await callLocalOpenAINonStream({
      baseUrl,
      model: preferred,
      messages: params.messages.map(message => ({ role: message.role as "user" | "assistant" | "system" | "tool", content: typeof message.content === "string" ? message.content : JSON.stringify(message.content) })),
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });
    const content = response.choices?.[0]?.message?.content || "";
    if (!content) throw new Error("LM Studio não retornou conteúdo para o planejamento.");
    return { id: "local-planner", model: preferred, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], usage: { total_tokens: 0 } } as GroqResponse;
  } catch (error) {
    if (process.env.LOCAL_ONLY_MODE === "true" || process.env.HYBRID_MODE_ENABLED !== "true") throw error;
    return invokeGroqNonStream({ model: "llama-3.3-70b-versatile", messages: params.messages, maxTokens: params.maxTokens, temperature: params.temperature });
  }
}
