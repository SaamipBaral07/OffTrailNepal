import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Loader2, SendHorizontal, X, Wifi, WifiOff, MessageCircle } from "lucide-react";
import api from "../api";
import { getToken } from "../tokenStore";
import { useAuth } from "../context/AuthContext";

const SOCKET_BASE_URL = "http://localhost:5000";

const formatMessageTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isSameMessage = (a, b) => Number(a?.message_id) === Number(b?.message_id);

const upsertMessage = (list, incoming) => {
  if (!incoming?.message_id) return list;
  const idx = list.findIndex((msg) => isSameMessage(msg, incoming));
  if (idx === -1) return [...list, incoming];
  const next = [...list];
  next[idx] = { ...next[idx], ...incoming };
  return next;
};

const normalizeRole = (role) => String(role || "").trim().toLowerCase();
const resolveUserId = (authUser) => Number(authUser?.user_id ?? authUser?.id);

const GuideBookingChatModal = ({ isOpen, onClose, booking, currentRole, onChatUpdated }) => {
  const { user } = useAuth();
  const bookingId = Number.parseInt(String(booking?.booking_id || ""), 10);
  const role = normalizeRole(currentRole || user?.user_type);

  const [chatMeta, setChatMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [error, setError] = useState("");
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  const participantLabel = useMemo(() => {
    if (!booking) return "";
    return role === "guide"
      ? `Tourist: ${booking.tourist_name || "Tourist"}`
      : `Guide: ${booking.guide_name || "Guide"}`;
  }, [booking, role]);

  const chatLocked = chatMeta?.can_chat === false || booking?.can_chat === false;
  const chatLockedReason =
    chatMeta?.chat_access_reason ||
    booking?.chat_access_reason ||
    "Chat window has closed for this booking.";

  const scrollToBottom = useCallback(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  const markAsRead = useCallback(async () => {
    if (!Number.isInteger(bookingId) || bookingId <= 0) return;

    try {
      await api.post(`/api/guide-bookings/chats/${bookingId}/read`, {});
      if (typeof onChatUpdated === "function") {
        onChatUpdated();
      }

      const socket = socketRef.current;
      if (socket && socket.connected) {
        socket.emit("chat:read", { bookingId });
      }
    } catch (_err) {
      // Read updates are best effort and should not break chat flow.
    }
  }, [bookingId, onChatUpdated]);

  const loadMessages = useCallback(async () => {
    if (!Number.isInteger(bookingId) || bookingId <= 0) return;

    setLoadingMessages(true);
    setError("");
    try {
      const res = await api.get(`/api/guide-bookings/chats/${bookingId}/messages?limit=250`);
      setChatMeta(res.data?.booking || null);
      setMessages(res.data?.messages || []);
      await markAsRead();
    } catch (err) {
      setError(err.response?.data?.message || "Could not load chat history");
    } finally {
      setLoadingMessages(false);
    }
  }, [bookingId, markAsRead]);

  const sendViaHttpFallback = useCallback(
    async (messageText) => {
      const response = await api.post(`/api/guide-bookings/chats/${bookingId}/messages`, {
        message: messageText,
      });
      const created = response.data?.chat_message;
      if (created) {
        setMessages((prev) => upsertMessage(prev, created));
      }
    },
    [bookingId]
  );

  const sendMessage = useCallback(async () => {
    if (chatLocked) {
      setError(chatLockedReason);
      return;
    }

    const text = String(messageInput || "").trim();
    if (!text) return;
    if (!Number.isInteger(bookingId) || bookingId <= 0) return;

    setSending(true);
    setError("");

    try {
      const socket = socketRef.current;
      if (socket && socket.connected) {
        await new Promise((resolve, reject) => {
          socket.emit("chat:message:send", { bookingId, message: text }, (ack) => {
            if (ack?.ok) {
              if (ack.message) {
                setMessages((prev) => upsertMessage(prev, ack.message));
              }
              resolve();
              return;
            }

            reject(new Error(ack?.message || "Failed to send message"));
          });
        });
      } else {
        await sendViaHttpFallback(text);
      }

      setMessageInput("");
      if (typeof onChatUpdated === "function") {
        onChatUpdated();
      }
    } catch (err) {
      try {
        await sendViaHttpFallback(text);
        setMessageInput("");
        if (typeof onChatUpdated === "function") {
          onChatUpdated();
        }
      } catch (fallbackErr) {
        setError(
          fallbackErr.response?.data?.message ||
            fallbackErr.message ||
            err.message ||
            "Failed to send message"
        );
      }
    } finally {
      setSending(false);
    }
  }, [bookingId, chatLocked, chatLockedReason, messageInput, onChatUpdated, sendViaHttpFallback]);

  useEffect(() => {
    if (!isOpen || !Number.isInteger(bookingId) || bookingId <= 0) return;
    loadMessages();
  }, [isOpen, bookingId, loadMessages]);

  useEffect(() => {
    if (!isOpen || !Number.isInteger(bookingId) || bookingId <= 0) return;

    const token = getToken();
    if (!token) return;

    const socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });

    socketRef.current = socket;

    const onConnect = () => {
      setIsSocketConnected(true);
      socket.emit("chat:join", { bookingId }, async (ack) => {
        if (!ack?.ok) {
          setError(ack?.message || "Unable to join live chat");
          return;
        }

        if (ack.booking) {
          setChatMeta(ack.booking);
        }

        await markAsRead();
      });
    };

    const onDisconnect = () => {
      setIsSocketConnected(false);
    };

    const onNewMessage = (incoming) => {
      if (Number(incoming?.booking_id) !== bookingId) return;
      setMessages((prev) => upsertMessage(prev, incoming));
      if (typeof onChatUpdated === "function") {
        onChatUpdated();
      }
      markAsRead();
    };

    const onReadUpdate = (summary) => {
      if (Number(summary?.booking_id) !== bookingId) return;
      if (typeof onChatUpdated === "function") {
        onChatUpdated();
      }
      const readAt = summary?.read_at || new Date().toISOString();
      const viewerRole = normalizeRole(summary?.viewer_role);

      // Messages sent by me are read when opposite role views the thread.
      if (viewerRole && viewerRole !== role) {
        setMessages((prev) =>
          prev.map((msg) =>
            normalizeRole(msg.sender_role) === role && !msg.read_at
              ? { ...msg, read_at: readAt }
              : msg
          )
        );
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:read:update", onReadUpdate);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:read:update", onReadUpdate);
      socket.disconnect();
      socketRef.current = null;
      setIsSocketConnected(false);
    };
  }, [bookingId, isOpen, markAsRead, onChatUpdated, role]);

  useEffect(() => {
    if (!isOpen) return;
    scrollToBottom();
  }, [messages, isOpen, scrollToBottom]);

  useEffect(() => {
    if (!isOpen) {
      setMessageInput("");
      setError("");
      setMessages([]);
      setChatMeta(null);
      setSending(false);
      setLoadingMessages(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[125] bg-black/45 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl rounded-3xl border border-navy/20 bg-white shadow-[0_24px_60px_rgba(12,35,64,0.25)] overflow-hidden">
        <div className="bg-gradient-to-r from-[#0C2340] via-[#163A5F] to-[#0C2340] px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-gold/90 font-semibold">Booking Chat</p>
              <h3 className="text-xl font-bold mt-1">{chatMeta?.service_title || booking?.service_title || "Guide Package"}</h3>
              <p className="text-xs text-white/75 mt-1">
                {participantLabel}
                {` • `}
                {chatMeta?.booking_code || booking?.booking_code || "-"}
              </p>
              <p className="text-[11px] text-white/65 mt-1 inline-flex items-center gap-1.5">
                {isSocketConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                {isSocketConnected ? "Live connected" : "Reconnecting..."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-white/25 px-2.5 py-2 text-white/85 hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-[56vh] max-h-[560px] min-h-[320px] bg-slate-50 px-4 py-4 overflow-y-auto">
          {loadingMessages ? (
            <div className="h-full flex items-center justify-center gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading chat history...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full rounded-2xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-center px-6">
              <MessageCircle className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No messages yet</p>
              <p className="text-xs text-slate-500 mt-1">Say hi to start coordinating your trek.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const mine = Number(msg.sender_id) === resolveUserId(user);
                return (
                  <div key={msg.message_id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        mine
                          ? "bg-navy text-white rounded-br-sm"
                          : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                      }`}
                    >
                      <p className={`text-[11px] font-semibold ${mine ? "text-gold/90" : "text-slate-500"}`}>
                        {mine ? "You" : msg.sender_name || (msg.sender_role === "guide" ? "Guide" : "Tourist")}
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mt-0.5">{msg.message_text}</p>
                      <p className={`text-[10px] mt-1 ${mine ? "text-white/70" : "text-slate-400"}`}>
                        {formatMessageTime(msg.created_at)}
                        {mine && msg.read_at ? " • Read" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white p-3.5">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          {chatLocked && !error && (
            <p className="text-xs text-amber-700 mb-2">{chatLockedReason}</p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Type your message..."
              disabled={chatLocked}
              className="flex-1 resize-none rounded-2xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-gold/40"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!sending) {
                    sendMessage();
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={chatLocked || sending || !String(messageInput || "").trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              {chatLocked ? "Chat Closed" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideBookingChatModal;
