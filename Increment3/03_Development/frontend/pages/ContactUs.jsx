import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Clock3,
  Send,
  MessageSquare,
  LifeBuoy,
  BadgeCheck,
  Loader2,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";
import api from "../api";

const OFFICE_MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d439.47247245717966!2d83.95775757798809!3d28.2140026156145!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3995951b4c297003%3A0x154f5b2110323833!2sLakeside%20Rd%2C%20Pokhara%2033700!5e0!3m2!1sen!2snp!4v1775540699240!5m2!1sen!2snp";
const OFFICE_MAP_DIRECTIONS_URL =
  "https://www.google.com/maps/place/Lakeside+Rd,+Pokhara+33700/";

const supportCards = [
  {
    icon: Mail,
    title: "General Inquiries",
    detail: "info@offtrailnepal.com",
    caption: "We usually reply within one business day.",
    href: "mailto:info@offtrailnepal.com",
  },
  {
    icon: Phone,
    title: "Call Support",
    detail: "+977-01-4XXXXXX",
    caption: "Mon to Sat, 9:00 AM - 6:00 PM (NPT)",
    href: "tel:+977014000000",
  },
  {
    icon: MapPin,
    title: "Office",
    detail: "Lakeside Road, Pokhara",
    caption: "Nepal 33700",
    href: null,
  },
];

const ContactUs = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const {
    handleLogout: originalHandleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [user, setUser] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitType, setSubmitType] = useState("idle");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    subject: "",
    category: "general",
    message: "",
  });
  const [myEnquiryReplies, setMyEnquiryReplies] = useState([]);
  const [myRepliesLoading, setMyRepliesLoading] = useState(false);
  const [myRepliesSummary, setMyRepliesSummary] = useState({
    total_replies: 0,
    unread_replies: 0,
  });
  const [markingRepliesRead, setMarkingRepliesRead] = useState(false);

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || authUser.full_name || "",
        email: prev.email || authUser.email || "",
      }));
    }
  }, [authUser]);

  const fetchMyEnquiryReplies = async () => {
    if (!user || user.user_type !== "tourist") {
      setMyEnquiryReplies([]);
      setMyRepliesSummary({ total_replies: 0, unread_replies: 0 });
      return;
    }

    setMyRepliesLoading(true);
    try {
      const res = await api.get("/api/contact/enquiries/my-replies", {
        params: { page: 1, limit: 12 },
      });

      setMyEnquiryReplies(Array.isArray(res.data?.replies) ? res.data.replies : []);
      setMyRepliesSummary({
        total_replies: Number(res.data?.summary?.total_replies || 0),
        unread_replies: Number(res.data?.summary?.unread_replies || 0),
      });
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error("Error fetching enquiry replies:", err);
      }
      setMyEnquiryReplies([]);
      setMyRepliesSummary({ total_replies: 0, unread_replies: 0 });
    } finally {
      setMyRepliesLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEnquiryReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, user?.user_type]);

  const handleLogout = () => {
    originalHandleLogout();
    navigate("/login", { replace: true });
  };

  const canSubmit = useMemo(() => {
    return (
      form.fullName.trim().length >= 2 &&
      /.+@.+\..+/.test(form.email.trim()) &&
      form.subject.trim().length >= 4 &&
      form.message.trim().length >= 15
    );
  }, [form]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitType !== "idle") {
      setSubmitType("idle");
      setSubmitMessage("");
    }
  };

  const markRepliesAsRead = async () => {
    if (!user || user.user_type !== "tourist") return;

    setMarkingRepliesRead(true);
    try {
      await api.patch("/api/contact/enquiries/my-replies/mark-read");
      await fetchMyEnquiryReplies();
    } catch (err) {
      console.error("Error marking enquiry replies as read:", err);
    } finally {
      setMarkingRepliesRead(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canSubmit) {
      setSubmitType("error");
      setSubmitMessage("Please complete all required fields with valid details before sending.");
      return;
    }

    setIsSending(true);

    try {
      const res = await api.post("/api/contact/enquiries", {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        category: form.category,
        message: form.message.trim(),
      });

      setSubmitType("success");
      setSubmitMessage(
        `Thanks, your enquiry has been submitted${res.data?.enquiry?.enquiry_id ? ` (Ref #${res.data.enquiry.enquiry_id})` : ""}. Our team will reach out soon.`
      );
      setForm((prev) => ({ ...prev, subject: "", message: "", category: "general" }));
    } catch (err) {
      setSubmitType("error");
      setSubmitMessage(err.response?.data?.message || "Something went wrong while sending your enquiry. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-[#f8f6f2] to-[#f1ece2]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-gradient-to-r from-navy via-navy-light to-navy-light/90 p-6 sm:p-8 shadow-[0_16px_35px_rgba(12,35,64,0.2)]">
          <p className="text-xs uppercase tracking-[0.2em] text-gold/90 font-semibold">Contact OffTrail Nepal</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-heading font-extrabold text-white">Let's Plan Better Adventures Together</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/70">
            Ask a question, report an issue, or share partnership ideas. Our support and operations team is ready to help.
          </p>
        </section>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="inline-flex items-center gap-2 text-navy mb-3">
                <LifeBuoy className="h-4 w-4" />
                <p className="text-sm font-bold uppercase tracking-wide">Support Channels</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                For urgent booking support, include your booking code in the subject so we can respond faster.
              </p>
            </div>

            {supportCards.map((card, index) => {
              const Icon = card.icon;
              const content = (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * index, duration: 0.35 }}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gold/15 text-gold-dark flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{card.title}</p>
                      <p className="text-base font-bold text-navy mt-0.5 break-words">{card.detail}</p>
                      <p className="text-xs text-gray-500 mt-1">{card.caption}</p>
                    </div>
                  </div>
                </motion.div>
              );

              if (!card.href) return content;

              return (
                <a key={card.title} href={card.href} className="block">
                  {content}
                </a>
              );
            })}

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-2.5">
                <BadgeCheck className="h-5 w-5 text-emerald-600 mt-0.5" />
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Verified hosts and tourists can also use in-platform chat for booking-specific communication.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm overflow-hidden">
              <div className="px-2 pt-2 pb-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Office Location</p>
                <h3 className="text-base font-bold text-navy mt-1">Lakeside Road, Pokhara</h3>
                <p className="text-xs text-gray-500 mt-1">Visit us for partnership meetings and operational support.</p>
              </div>

              <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100" style={{ paddingTop: "70%" }}>
                <iframe
                  title="OffTrail Nepal Office Location"
                  src={OFFICE_MAP_EMBED_URL}
                  className="absolute inset-0 h-full w-full"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>

              <a
                href={OFFICE_MAP_DIRECTIONS_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold text-navy hover:bg-gold/20"
              >
                <MapPin className="h-3.5 w-3.5" />
                Open in Google Maps
              </a>
            </div>
          </div>

          <div className="lg:col-span-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
            {user?.user_type === "tourist" && (
              <div className="mb-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 text-blue-800">
                      <BellRing className="h-4 w-4" />
                      <p className="text-xs font-bold uppercase tracking-wide">Reply Notifications</p>
                    </div>
                    <p className="mt-1 text-sm text-blue-900 font-semibold">Messages from OffTrail Admin on your contact enquiries</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {myRepliesSummary.unread_replies} unread of {myRepliesSummary.total_replies} total replies
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchMyEnquiryReplies}
                      disabled={myRepliesLoading}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      {myRepliesLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={markRepliesAsRead}
                      disabled={markingRepliesRead || myRepliesSummary.unread_replies < 1}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60"
                    >
                      {markingRepliesRead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
                      Mark All Read
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {myRepliesLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-blue-200 bg-white py-5">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  ) : myEnquiryReplies.length === 0 ? (
                    <div className="rounded-xl border border-blue-200 bg-white p-3 text-sm text-blue-700">
                      No admin replies yet. Once support responds, your updates will appear here.
                    </div>
                  ) : (
                    myEnquiryReplies.map((reply) => {
                      const unread = !reply.admin_reply_read_at;
                      return (
                        <div
                          key={reply.enquiry_id}
                          className="rounded-xl border border-blue-200 bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                            <p className="text-sm font-bold text-navy">{reply.subject || "Contact enquiry"}</p>
                            <div className="flex items-center gap-2">
                              {unread && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                                  New
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500">{formatDateTime(reply.admin_reply_at)}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {reply.admin_reply_message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mb-5 text-navy">
              <MessageSquare className="h-4 w-4" />
              <h2 className="text-sm font-bold uppercase tracking-wide">Send a Message</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => updateForm("fullName", e.target.value)}
                    placeholder="Your full name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Subject</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => updateForm("subject", e.target.value)}
                    placeholder="What can we help with?"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                  >
                    <option value="general">General</option>
                    <option value="booking">Booking Issue</option>
                    <option value="host-support">Host Support</option>
                    <option value="guide-support">Guide Support</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Message</label>
                <textarea
                  rows={7}
                  value={form.message}
                  onChange={(e) => updateForm("message", e.target.value)}
                  placeholder="Please include relevant details such as trail, dates, booking code, and your request."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold resize-y"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <div className="text-xs text-gray-500 inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  Average reply time: within 24 business hours
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || isSending}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-navy bg-gradient-to-r from-gold to-[#D4A43A] shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {isSending ? "Preparing..." : "Send Message"}
                </button>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                By submitting, your enquiry is securely stored in OffTrail admin tools so our operations team can follow up quickly.
              </p>

              {submitType !== "idle" && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-sm ${
                    submitType === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  {submitMessage}
                </div>
              )}
            </form>
          </div>
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

export default ContactUs;
