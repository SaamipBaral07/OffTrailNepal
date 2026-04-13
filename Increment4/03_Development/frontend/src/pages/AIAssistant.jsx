import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, MessageCircle, Plus, Send } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AIAssistant = () => {
  const { user } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState(null);

  const pushNotice = useCallback((message, type = "error") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadConversations = useCallback(async ({ selectFirst = false } = {}) => {
    setIsLoadingConversations(true);
    try {
      const res = await api.get("/api/ai-chat/conversations");
      const list = Array.isArray(res.data?.conversations) ? res.data.conversations : [];
      setConversations(list);

      if (selectFirst) {
        if (list.length > 0) {
          setActiveConversationId((prev) => prev || list[0].conversation_id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
    } catch (error) {
      pushNotice(error.response?.data?.message || "Could not load AI chats");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [pushNotice]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    try {
      const res = await api.get(`/api/ai-chat/conversations/${conversationId}/messages`);
      setMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
    } catch (error) {
      pushNotice(error.response?.data?.message || "Could not load conversation messages");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [pushNotice]);

  useEffect(() => {
    loadConversations({ selectFirst: true });
  }, [loadConversations]);

  useEffect(() => {
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  const createNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setDraft("");
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmed = String(draft || "").trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    const optimisticUserMessage = {
      message_id: `temp-user-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setDraft("");

    try {
      const payload = {
        message: trimmed,
      };
      if (activeConversationId) {
        payload.conversation_id = activeConversationId;
      }

      const res = await api.post("/api/ai-chat/message", payload);

      const nextConversationId = res.data?.conversation_id || activeConversationId;
      if (nextConversationId) {
        setActiveConversationId(nextConversationId);
      }

      const serverUser = res.data?.user_message;
      const assistant = res.data?.assistant_message;

      setMessages((prev) => {
        const withoutTempUser = prev.filter((msg) => msg.message_id !== optimisticUserMessage.message_id);
        const next = [...withoutTempUser];
        if (serverUser) next.push(serverUser);
        if (assistant) next.push(assistant);
        return next;
      });

      if (res.data?.ai_error) {
        pushNotice(`AI fallback used: ${res.data.ai_error}`, "warning");
      }

      await loadConversations({ selectFirst: false });
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.message_id !== optimisticUserMessage.message_id));
      pushNotice(error.response?.data?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const activeConversation = useMemo(
    () => conversations.find((item) => item.conversation_id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      {notice && (
        <div
          className={`fixed right-4 top-20 z-[100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            notice.type === "warning" ? "bg-amber-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {notice.message}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-white/90 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold">Conversational AI</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-[#0C2340]">AI Assistant</h1>
              <p className="mt-2 text-[#0C2340]/70 max-w-3xl">
                Ask anything like ChatGPT. You can ask general questions, travel questions, or OffTrail-specific planning questions.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <aside className="lg:col-span-4 rounded-3xl border border-[#0C2340]/12 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-[#0C2340] uppercase tracking-[0.18em]">History</h2>
              <button
                type="button"
                onClick={createNewConversation}
                className="inline-flex items-center gap-1 rounded-lg border border-[#0C2340]/15 px-2.5 py-1.5 text-xs hover:bg-[#F5F8FC]"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>

            {isLoadingConversations ? (
              <div className="py-6 text-sm text-[#0C2340]/65 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-sm text-[#0C2340]/65">No chats yet. Start by asking your first question.</p>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                {conversations.map((item) => {
                  const isActive = item.conversation_id === activeConversationId;
                  return (
                    <button
                      key={item.conversation_id}
                      type="button"
                      onClick={() => setActiveConversationId(item.conversation_id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition ${
                        isActive
                          ? "border-[#0C2340] bg-[#0C2340]/5"
                          : "border-[#0C2340]/12 hover:bg-[#F9FBFE]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-[#0C2340] truncate">{item.title || `Chat ${item.conversation_id}`}</p>
                      <p className="text-xs text-[#0C2340]/65 mt-1 truncate">{item.last_message_preview || "No messages yet"}</p>
                      <p className="text-[11px] text-[#0C2340]/50 mt-1">{formatDateTime(item.last_message_at || item.updated_at)}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <article className="lg:col-span-8 rounded-3xl border border-[#0C2340]/12 bg-white p-4 sm:p-5 shadow-sm flex flex-col h-[70vh]">
            <div className="pb-3 border-b border-[#0C2340]/10 mb-3">
              <h2 className="text-base font-bold text-[#0C2340] flex items-center gap-2">
                <Bot className="h-4 w-4 text-gold" />
                {activeConversation?.title || "New AI Chat"}
              </h2>
            </div>

            <div className="flex-1 overflow-auto pr-1 space-y-3">
              {isLoadingMessages ? (
                <div className="py-10 text-sm text-[#0C2340]/65 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full min-h-[240px] grid place-items-center text-center text-[#0C2340]/60 px-6">
                  <div>
                    <MessageCircle className="h-9 w-9 mx-auto text-gold mb-2" />
                    Ask anything to start this chat.
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div key={message.message_id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          isUser
                            ? "bg-[#0C2340] text-white"
                            : "bg-[#F5F8FC] text-[#0C2340] border border-[#0C2340]/10"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p className={`mt-1 text-[11px] ${isUser ? "text-white/70" : "text-[#0C2340]/55"}`}>
                          {formatDateTime(message.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={sendMessage} className="pt-3 border-t border-[#0C2340]/10 mt-3">
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask any question..."
                  className="flex-1 rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold/35"
                />
                <button
                  type="submit"
                  disabled={isSending || !String(draft || "").trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0C2340] to-[#1E4C76] px-4 text-white font-semibold disabled:opacity-60"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </form>
          </article>
        </section>
      </main>

      <Footer />

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default AIAssistant;
