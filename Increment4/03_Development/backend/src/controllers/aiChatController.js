import pool from "../config/db.js";
import { generateChatReply } from "../services/aiChatService.js";

const parseConversationId = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const sanitizeIncomingMessage = (value) => String(value || "").trim().slice(0, 4000);

const buildConversationTitle = (messageText) => {
  const sanitized = sanitizeIncomingMessage(messageText);
  if (!sanitized) return "New Chat";
  if (sanitized.length <= 64) return sanitized;
  return `${sanitized.slice(0, 61)}...`;
};

const buildFallbackAssistantAnswer = (messageText) => {
  const lower = String(messageText || "").toLowerCase();

  if (lower.includes("everest base camp") || lower.includes("ebc")) {
    return [
      "Everest Base Camp (EBC) is amazing, but preparation matters.",
      "",
      "1) Best seasons: pre-monsoon (Mar-May) and post-monsoon (late Sep-Nov).",
      "2) Duration: usually 12-14 trekking days (plus buffer/weather days).",
      "3) Altitude risk: EBC is about 5,364 m and Kala Patthar is about 5,545 m.",
      "4) Acclimatization: plan rest days (commonly Namche and Dingboche).",
      "5) Fitness: train with uphill cardio + loaded day hikes for 6-8 weeks.",
      "6) Budget: depends on guide, porter, flights, season, and comfort level.",
      "7) Key logistics: Lukla flight reliability, permits, travel insurance with high-altitude rescue coverage.",
      "8) Gear basics: broken-in boots, layered insulation, down jacket, warm gloves, headlamp, water purification.",
      "9) Health: go slow, hydrate, avoid rapid ascent; descend if severe altitude symptoms appear.",
      "10) Smart tip: keep at least 1-2 contingency days for weather delays.",
      "",
      "If you want, I can give you a practical day-by-day EBC itinerary with acclimatization and a budget breakdown.",
    ].join("\n");
  }

  if (lower.includes("trek") || lower.includes("hike") || lower.includes("mountain")) {
    return [
      "Here is a quick trekking checklist:",
      "1) Pick season and route based on your fitness and altitude tolerance.",
      "2) Add acclimatization/rest days for higher routes.",
      "3) Budget for guide/porter, lodging, food, permits, transport, and emergency reserve.",
      "4) Carry layered clothing, proper boots, water treatment, and basic first-aid.",
      "5) Keep weather buffer days and descend if altitude symptoms worsen.",
      "",
      "Share your target route and trip days, and I can draft a tailored plan.",
    ].join("\n");
  }

  return "I am temporarily unable to use the AI model. Please retry in a moment, or share your question and I will provide a concise practical answer.";
};

const mapMessage = (row) => ({
  message_id: row.message_id,
  role: row.role,
  content: row.content,
  provider: row.provider,
  model: row.model,
  created_at: row.created_at,
});

export const getMyConversations = async (req, res) => {
  try {
    const touristId = req.user.user_id;

    const result = await pool.query(
      `SELECT c.conversation_id,
              c.title,
              c.created_at,
              c.updated_at,
              c.last_message_at,
              m.role AS last_message_role,
              LEFT(m.content, 160) AS last_message_preview
       FROM ai_chat_conversations c
       LEFT JOIN LATERAL (
         SELECT role, content
         FROM ai_chat_messages m2
         WHERE m2.conversation_id = c.conversation_id
         ORDER BY m2.created_at DESC, m2.message_id DESC
         LIMIT 1
       ) m ON true
       WHERE c.tourist_id = $1
       ORDER BY c.last_message_at DESC, c.updated_at DESC
       LIMIT 100`,
      [touristId]
    );

    return res.status(200).json({ conversations: result.rows });
  } catch (error) {
    if (error?.code === "53300") {
      return res.status(503).json({ message: "Database is temporarily busy. Please retry shortly." });
    }
    console.error("Error fetching AI chat conversations:", error);
    return res.status(500).json({ message: "Server error fetching conversations" });
  }
};

export const getMyConversationMessages = async (req, res) => {
  try {
    const touristId = req.user.user_id;
    const conversationId = parseConversationId(req.params.conversationId);

    if (!conversationId) {
      return res.status(400).json({ message: "Invalid conversation id" });
    }

    const ownershipResult = await pool.query(
      `SELECT conversation_id, title, created_at, updated_at, last_message_at
       FROM ai_chat_conversations
       WHERE conversation_id = $1
         AND tourist_id = $2`,
      [conversationId, touristId]
    );

    if (!ownershipResult.rows.length) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messagesResult = await pool.query(
      `SELECT message_id, role, content, provider, model, created_at
       FROM ai_chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC, message_id ASC`,
      [conversationId]
    );

    return res.status(200).json({
      conversation: ownershipResult.rows[0],
      messages: messagesResult.rows.map(mapMessage),
    });
  } catch (error) {
    if (error?.code === "53300") {
      return res.status(503).json({ message: "Database is temporarily busy. Please retry shortly." });
    }
    console.error("Error fetching AI chat messages:", error);
    return res.status(500).json({ message: "Server error fetching messages" });
  }
};

export const sendChatMessage = async (req, res) => {
  const touristId = req.user.user_id;
  const message = sanitizeIncomingMessage(req.body?.message);

  if (!message) {
    return res.status(400).json({ message: "message is required" });
  }

  const requestedConversationId = parseConversationId(req.body?.conversation_id ?? req.params?.conversationId);

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    let conversationId = requestedConversationId;

    if (conversationId) {
      const ownershipResult = await client.query(
        `SELECT conversation_id
         FROM ai_chat_conversations
         WHERE conversation_id = $1
           AND tourist_id = $2
         FOR UPDATE`,
        [conversationId, touristId]
      );

      if (!ownershipResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Conversation not found" });
      }
    } else {
      const createResult = await client.query(
        `INSERT INTO ai_chat_conversations (tourist_id, title)
         VALUES ($1, $2)
         RETURNING conversation_id`,
        [touristId, buildConversationTitle(message)]
      );
      conversationId = createResult.rows[0].conversation_id;
    }

    const insertUserResult = await client.query(
      `INSERT INTO ai_chat_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)
       RETURNING message_id, role, content, provider, model, created_at`,
      [conversationId, message]
    );

    const historyResult = await client.query(
      `SELECT role, content
       FROM ai_chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC, message_id ASC
       LIMIT 40`,
      [conversationId]
    );

    let aiReply;
    try {
      aiReply = await generateChatReply({
        message,
        historyMessages: historyResult.rows.slice(0, -1),
      });
    } catch (aiError) {
      const fallbackText = buildFallbackAssistantAnswer(message);
      aiReply = {
        provider: "fallback",
        model: null,
        answer: fallbackText,
        usage: null,
        ai_error: aiError?.message || "Unknown AI error",
      };
    }

    const insertAssistantResult = await client.query(
      `INSERT INTO ai_chat_messages (conversation_id, role, content, provider, model, usage)
       VALUES ($1, 'assistant', $2, $3, $4, $5::jsonb)
       RETURNING message_id, role, content, provider, model, created_at`,
      [
        conversationId,
        aiReply.answer,
        aiReply.provider,
        aiReply.model,
        aiReply.usage ? JSON.stringify(aiReply.usage) : null,
      ]
    );

    await client.query(
      `UPDATE ai_chat_conversations
       SET updated_at = CURRENT_TIMESTAMP,
           last_message_at = CURRENT_TIMESTAMP,
           title = CASE
             WHEN title = 'New Chat' THEN $2
             ELSE title
           END
       WHERE conversation_id = $1`,
      [conversationId, buildConversationTitle(message)]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      conversation_id: conversationId,
      user_message: mapMessage(insertUserResult.rows[0]),
      assistant_message: mapMessage(insertAssistantResult.rows[0]),
      provider: aiReply.provider,
      model: aiReply.model,
      ai_error: aiReply.ai_error || null,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback errors
      }
    }

    if (error?.code === "53300") {
      return res.status(503).json({ message: "Database is temporarily busy. Please retry shortly." });
    }

    console.error("Error sending AI chat message:", error);
    return res.status(500).json({ message: "Server error sending AI chat message" });
  } finally {
    if (client) client.release();
  }
};
