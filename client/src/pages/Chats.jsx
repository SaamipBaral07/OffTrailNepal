// ╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ GET  /api/guide-bookings/chats/my                → guideBookingRoutes.js → guideBookingChatController.getMyGuideBookingChats 
// ║ (via GuideBookingChatModal component)                                                                     
// ║ GET  /api/guide-bookings/chats/:id/messages       → guideBookingRoutes.js → guideBookingChatController.getGuideBookingChatMessagesController ║
// ║ POST /api/guide-bookings/chats/:id/messages       → guideBookingRoutes.js → guideBookingChatController.postGuideBookingChatMessageController ║
// ║ POST /api/guide-bookings/chats/:id/read           → guideBookingRoutes.js → guideBookingChatController.markGuideBookingChatReadController    ║
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════╝

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  MessageCircle,
  Loader2,
  CalendarDays,
  MapPin,
  User,
  ArrowLeft,
} from "lucide-react";
import { io } from "socket.io-client";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import GuideBookingChatModal from "../components/GuideBookingChatModal";
import LogoutModal from "../components/LogoutModal";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { getToken } from "../tokenStore";
import api from "../api";

const SOCKET_BASE_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || "http://localhost:5000";
const CHAT_LIST_POLL_INTERVAL_MS = 15000;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const Chats = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { handleLogout, handleStayLoggedIn, showLogoutModal, setShowLogoutModal } = useLogoutHandler();

  const socketRef = useRef(null);
  const joinedBookingsRef = useRef(new Set());

  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [error, setError] = useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);

  const currentRole = String(user?.user_type || "").toLowerCase();

  const canUseChatPage = currentRole === "tourist" || currentRole === "guide";

  const joinRooms = useCallback((chatList) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    chatList.forEach((chat) => {
      const bookingId = Number(chat?.booking_id);
      if (!Number.isInteger(bookingId) || bookingId <= 0) return;
      if (joinedBookingsRef.current.has(bookingId)) return;

      socket.emit("chat:join", { bookingId }, (ack) => {
        if (ack?.ok) {
          joinedBookingsRef.current.add(bookingId);
        }
      });
    });
  }, []);

  const fetchChats = useCallback(async ({ initial = false, silent = false } = {}) => {
    if (!canUseChatPage) return;

    if (initial) setLoadingChats(true);

    if (!silent) setError("");
    try {
      const res = await api.get("/api/guide-bookings/chats/my");
      const nextChats = res.data?.chats || [];
      setChats(nextChats);
      joinRooms(nextChats);
    } catch (err) {
      if (!silent) {
        setError(err.response?.data?.message || "Could not load chat list");
      }
    } finally {
      setLoadingChats(false);
    }
  }, [canUseChatPage, joinRooms]);

  useEffect(() => {
    if (loading) return;

    if (!getToken() || !user) {
      navigate("/login", { replace: true });
      return;
    }

    if (!canUseChatPage) {
      navigate("/", { replace: true });
      return;
    }

    fetchChats({ initial: true });
  }, [loading, user, canUseChatPage, navigate, fetchChats]);

  useEffect(() => {
    if (loading || !canUseChatPage || !getToken()) return;

    const socket = io(SOCKET_BASE_URL, {
      auth: { token: getToken() },
      transports: ["websocket", "polling"],
      autoConnect: false,
    });

    socketRef.current = socket;
    const joinedBookings = joinedBookingsRef.current;

    const syncSilently = () => fetchChats({ silent: true });

    const onConnect = () => {
      joinedBookings.clear();
      syncSilently();
    };

    const onNewMessage = () => {
      syncSilently();
    };

    const onReadUpdate = () => {
      syncSilently();
    };

    socket.on("connect", onConnect);
    socket.on("chat:message:new", onNewMessage);
    socket.on("chat:read:update", onReadUpdate);

    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("chat:message:new", onNewMessage);
      socket.off("chat:read:update", onReadUpdate);
      socket.disconnect();
      socketRef.current = null;
      joinedBookings.clear();
    };
  }, [canUseChatPage, fetchChats, loading]);

  useEffect(() => {
    if (loading || !canUseChatPage || !getToken()) return;

    const syncSilently = () => fetchChats({ silent: true });
    const intervalId = window.setInterval(syncSilently, CHAT_LIST_POLL_INTERVAL_MS);

    const onWindowFocus = () => {
      syncSilently();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncSilently();
      }
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [canUseChatPage, fetchChats, loading]);

  const openChat = useCallback((chatBooking) => {
    if (chatBooking?.can_chat === false) {
      setError(chatBooking?.chat_access_reason || "This chat window is no longer available.");
      return;
    }

    setActiveChat(chatBooking);
    setChatOpen(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("booking", String(chatBooking.booking_id));
      return next;
    });
  }, [setSearchParams]);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setActiveChat(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("booking");
      return next;
    });
  }, [setSearchParams]);

  useEffect(() => {
    if (!chats.length) return;
    const targetBookingId = Number.parseInt(String(searchParams.get("booking") || ""), 10);
    if (!Number.isInteger(targetBookingId) || targetBookingId <= 0) return;

    const targetChat = chats.find((chat) => Number(chat.booking_id) === targetBookingId);
    if (targetChat) {
      setActiveChat(targetChat);
      setChatOpen(true);
    }
  }, [chats, searchParams]);

  const totalUnread = useMemo(
    () => chats.reduce((sum, chat) => sum + Number(chat.unread_count || 0), 0),
    [chats]
  );

  const syncChatSummaries = useCallback(() => {
    fetchChats({ silent: true });
  }, [fetchChats]);

  if (loading || loadingChats) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
        <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />
        <div className="max-w-6xl mx-auto px-6 pt-32 pb-20 flex items-center justify-center">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading chats...
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-navy/10 bg-white/95 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="uppercase text-[11px] tracking-[0.24em] text-gold-dark font-semibold mb-2">Realtime Messaging</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal">Chats</h1>
              <p className="text-gray-500 mt-2">Talk directly with your booked guide or tourist for trek coordination.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {currentRole === "guide" && (
                <Link
                  to="/guide-dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-navy/20 bg-white px-4 py-2 text-navy text-sm font-semibold hover:border-navy/35 hover:bg-navy/5 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Guide Dashboard
                </Link>
              )}
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-blue-700 text-sm font-semibold">
                <MessageCircle className="h-4 w-4" />
                {totalUnread} unread
              </span>
            </div>
          </div>

        </section>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!error && chats.length === 0 ? (
          <section className="rounded-3xl border border-navy/10 bg-white p-8 text-center shadow-[0_10px_24px_rgba(12,35,64,0.06)]">
            <MessageCircle className="h-10 w-10 mx-auto text-blue-500 mb-3" />
            <h2 className="text-xl font-bold text-charcoal">No active chats yet</h2>
            <p className="text-gray-500 mt-2 mb-5">A chat appears automatically after a paid guide-package booking is eligible.</p>
            <Link
              to={currentRole === "guide" ? "/guide-dashboard" : "/my-bookings"}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
            >
              Go to {currentRole === "guide" ? "Guide Dashboard" : "My Bookings"}
            </Link>
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chats.map((chat) => {
              const unreadCount = Number(chat.unread_count || 0);
              const otherPerson = currentRole === "guide" ? chat.tourist_name : chat.guide_name;
              const chatLocked = chat?.can_chat === false;

              return (
                <article
                  key={chat.booking_id}
                  className="rounded-3xl border border-navy/10 bg-white p-5 shadow-[0_10px_24px_rgba(12,35,64,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-charcoal">{chat.service_title}</h2>
                      <p className="text-xs text-gray-500 mt-1">Booking Code: {chat.booking_code}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(chat.start_date)} to {formatDate(chat.end_date)}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                      {unreadCount} unread
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                    <p className="flex items-center gap-2"><User className="h-4 w-4 text-navy" /> {otherPerson || "Participant"}</p>
                    <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gold" /> {chat.trail_name || "-"}</p>
                    <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-navy" /> Status: {chat.booking_status}</p>
                  </div>

                  {chat.last_message && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Latest Message</p>
                      <p className="text-sm text-slate-700 mt-1 line-clamp-2">{chat.last_message.message_text}</p>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    {chatLocked && (
                      <p className="text-xs text-amber-700 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                        {chat.chat_access_reason || "Chat window has closed for this booking."}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => openChat(chat)}
                      disabled={chatLocked}
                      className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold ${chatLocked ? "border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed" : "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"}`}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {chatLocked ? "Chat Closed" : "Open Chat"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <GuideBookingChatModal
        isOpen={chatOpen}
        onClose={closeChat}
        booking={activeChat}
        currentRole={currentRole}
        onChatUpdated={syncChatSummaries}
      />

      <LogoutModal
        isOpen={showLogoutModal}
        onCancel={handleStayLoggedIn}
        onConfirm={handleLogout}
      />

      <Footer />
    </div>
  );
};

export default Chats;
