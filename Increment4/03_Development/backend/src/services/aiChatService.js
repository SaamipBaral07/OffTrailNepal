const MAX_HISTORY_MESSAGES = 12;
const DEFAULT_CHAT_TIMEOUT_MS = 45000;

const normalizeModelJsonText = (content) => {
  if (content === undefined || content === null) return "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        return "";
      })
      .join("\n")
      .trim();
  }
  return String(content).trim();
};

const detectLLMProvider = (apiUrl) => {
  const configuredProvider = String(process.env.AI_LLM_PROVIDER || "").trim().toLowerCase();
  if (configuredProvider) return configuredProvider;

  try {
    const parsed = new URL(apiUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    const port = String(parsed.port || "");
    if ((host === "localhost" || host === "127.0.0.1") && port === "11434") {
      return "ollama";
    }
  } catch {
    // fall through to openai default
  }

  return "openai";
};

const sanitizeHistory = (historyMessages = []) =>
  historyMessages
    .filter((message) => ["user", "assistant", "system"].includes(String(message.role || "")))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: String(message.role),
      content: String(message.content || "").slice(0, 4000),
    }));

const buildSystemPrompt = () => {
  const segments = [
    "You are OffTrail AI Assistant.",
    "You can answer both general questions and OffTrail travel questions.",
    "For OffTrail-specific facts, do not invent data. If uncertain, say you are unsure.",
    "Keep responses practical, clear, and concise.",
  ];
  return segments.join(" ");
};

export const generateChatReply = async ({ message, historyMessages = [] }) => {
  const model = process.env.AI_CHAT_MODEL || "qwen2.5:3b-instruct";
  const apiUrl = process.env.AI_LLM_API_URL || "https://api.openai.com/v1/chat/completions";
  const provider = detectLLMProvider(apiUrl);
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const isOllama = provider === "ollama";

  if (!isOllama && !apiKey) {
    const error = new Error("No API key configured for hosted AI provider");
    error.code = "NO_AI_CREDENTIALS";
    throw error;
  }

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    ...sanitizeHistory(historyMessages),
    { role: "user", content: String(message || "").slice(0, 4000) },
  ];

  const headers = {
    "Content-Type": "application/json",
  };

  if (!isOllama && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const requestBody = {
    model,
    temperature: isOllama ? 0.7 : 0.5,
    messages,
    max_tokens: 260,
  };

  if (isOllama) {
    requestBody.stream = false;
  }

  const parsedTimeout = Number.parseInt(
    process.env.AI_CHAT_TIMEOUT_MS || process.env.AI_LLM_TIMEOUT_MS || String(DEFAULT_CHAT_TIMEOUT_MS),
    10
  );
  const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0
    ? parsedTimeout
    : DEFAULT_CHAT_TIMEOUT_MS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      const error = new Error(`AI API error ${response.status}: ${bodyText.slice(0, 400)}`);
      error.code = "AI_API_ERROR";
      throw error;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const answer = normalizeModelJsonText(content);

    if (!answer) {
      const error = new Error("AI returned an empty response");
      error.code = "EMPTY_AI_RESPONSE";
      throw error;
    }

    return {
      provider,
      model,
      answer,
      usage: payload?.usage || null,
    };
  } finally {
    clearTimeout(timeout);
  }
};
