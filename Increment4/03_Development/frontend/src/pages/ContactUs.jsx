import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Clock3,
  Send,
  MessageSquare,
  Star,
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
const TESTIMONIAL_ELIGIBLE_USER_TYPES = new Set(["tourist", "host", "guide"]);

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
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    reviewText: "",
    reviewerLocation: "",
  });
  const [myPlatformReview, setMyPlatformReview] = useState(null);
  const [myPlatformReviewLoading, setMyPlatformReviewLoading] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitType, setReviewSubmitType] = useState("idle");
  const [reviewSubmitMessage, setReviewSubmitMessage] = useState("");
  const [touristPanelTab, setTouristPanelTab] = useState("replies");

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

  const canUseSupportPortal = useMemo(() => {
    return TESTIMONIAL_ELIGIBLE_USER_TYPES.has(String(user?.user_type || ""));
  }, [user?.user_type]);

  const fetchMyEnquiryReplies = async () => {
    if (!canUseSupportPortal) {
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
  }, [user?.user_id, user?.user_type, canUseSupportPortal]);

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

  const canSubmitReview = useMemo(() => {
    return (
      Number.isInteger(Number(reviewForm.rating)) &&
      Number(reviewForm.rating) >= 1 &&
      Number(reviewForm.rating) <= 5 &&
      String(reviewForm.reviewText || "").trim().length >= 20
    );
  }, [reviewForm]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitType !== "idle") {
      setSubmitType("idle");
      setSubmitMessage("");
    }
  };

  const markRepliesAsRead = async () => {
    if (!canUseSupportPortal) return;

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

  const fetchMyPlatformReview = async () => {
    if (!canUseSupportPortal) {
      setMyPlatformReview(null);
      return;
    }

    setMyPlatformReviewLoading(true);
    try {
      const res = await api.get("/api/contact/testimonials/me");
      const review = res.data?.review || null;
      setMyPlatformReview(review);
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        console.error("Error fetching my platform review:", err);
      }
      setMyPlatformReview(null);
    } finally {
      setMyPlatformReviewLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPlatformReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id, user?.user_type, canUseSupportPortal]);

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

  const handleReviewSubmit = async (event) => {
    event.preventDefault();

    if (!canUseSupportPortal) {
      setReviewSubmitType("error");
      setReviewSubmitMessage("Only logged-in tourist, host, or guide accounts can submit platform testimonials.");
      return;
    }

    if (!canSubmitReview) {
      setReviewSubmitType("error");
      setReviewSubmitMessage("Please provide a rating and a review with at least 20 characters.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await api.post("/api/contact/testimonials", {
        rating: Number(reviewForm.rating),
        reviewText: String(reviewForm.reviewText || "").trim(),
        reviewerLocation: String(reviewForm.reviewerLocation || "").trim(),
      });

      setReviewSubmitType("success");
      setReviewSubmitMessage(res.data?.message || "Your review was saved successfully.");
      setReviewForm({
        rating: 5,
        reviewText: "",
        reviewerLocation: "",
      });
      await fetchMyPlatformReview();
    } catch (err) {
      setReviewSubmitType("error");
      setReviewSubmitMessage(err.response?.data?.message || "Unable to submit your review right now.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f3eee4]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-80 w-80 rounded-full bg-navy/10 blur-3xl" />
        <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-alpine/10 blur-3xl" />
      </div>
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-20">
        <section className="rounded-[2rem] border border-white/40 bg-gradient-to-br from-[#0b213d] via-[#12345c] to-[#22416a] p-6 sm:p-8 shadow-[0_20px_50px_rgba(12,35,64,0.35)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8">
              <p className="text-[11px] uppercase tracking-[0.24em] text-gold/90 font-semibold">Contact OffTrail Nepal</p>
              <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white leading-tight">
                Support That Feels Personal,
                <span className="text-gold"> Fast, and Accountable</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm sm:text-base text-white/75 leading-relaxed">
                One clean place to raise issues, ask questions, and receive updates from our operations team.
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-wrap gap-2.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                Reply target: &lt; 24h
              </span>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                Mon-Sat, 9AM-6PM
              </span>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">
                Account notifications enabled
              </span>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-[#d9d3c4] bg-[#fffefd] p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1 text-navy">
                <MessageSquare className="h-4 w-4" />
                <h2 className="text-sm font-bold uppercase tracking-wide">Case Intake Form</h2>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                Share the full context and we will route your case to the right team.
              </p>

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
                    rows={8}
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

            <div className="rounded-2xl border border-[#d9d3c4] bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Office Location</p>
                  <h3 className="text-lg font-bold text-navy mt-1">Lakeside Road, Pokhara</h3>
                </div>
                <a
                  href={OFFICE_MAP_DIRECTIONS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-bold text-navy hover:bg-gold/20 whitespace-nowrap"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Open in Maps
                </a>
              </div>
              <div className="relative h-[320px] sm:h-[400px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
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
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-[#d9d3c4] bg-[#fffefd] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-navy mb-3">
                <LifeBuoy className="h-4 w-4" />
                <p className="text-sm font-bold uppercase tracking-wide">Support Desk</p>
              </div>

              <div className="space-y-3 text-sm">
                <a href="mailto:info@offtrailnepal.com" className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">
                  <span className="inline-flex items-center gap-2 text-gray-700"><Mail className="h-4 w-4 text-navy" /> Email</span>
                  <span className="font-semibold text-navy">info@offtrailnepal.com</span>
                </a>
                <a href="tel:+977014000000" className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50">
                  <span className="inline-flex items-center gap-2 text-gray-700"><Phone className="h-4 w-4 text-navy" /> Call</span>
                  <span className="font-semibold text-navy">+977-01-4XXXXXX</span>
                </a>
                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-gray-700"><Clock3 className="h-4 w-4 text-navy" /> Hours</span>
                  <span className="font-semibold text-navy">Mon-Sat, 9AM-6PM</span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 flex items-start gap-2">
                <BadgeCheck className="h-4 w-4 mt-0.5 text-emerald-600" />
                Signed-in tourist, host, and guide users can see admin responses directly in this page.
              </div>
            </div>

            <div className="rounded-2xl border border-[#d9d3c4] bg-[#fffefd] p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-navy">
                <Star className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Account Updates</h3>
              </div>

              {!canUseSupportPortal ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Please log in as a tourist, host, or guide account to access reply notifications and submit testimonials.
                </div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                    <button
                      type="button"
                      onClick={() => setTouristPanelTab("replies")}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        touristPanelTab === "replies"
                          ? "bg-white text-navy shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Replies
                    </button>
                    <button
                      type="button"
                      onClick={() => setTouristPanelTab("testimonial")}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        touristPanelTab === "testimonial"
                          ? "bg-white text-navy shadow-sm"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Testimonial
                    </button>
                  </div>

                  {touristPanelTab === "replies" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="inline-flex items-center gap-2 text-blue-800">
                            <BellRing className="h-4 w-4" />
                            <p className="text-xs font-bold uppercase tracking-wide">Reply Notifications</p>
                          </div>
                          <p className="text-xs text-blue-700 mt-1">
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
                            Mark Read
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
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
                  ) : myPlatformReviewLoading ? (
                    <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-gold-dark" />
                    </div>
                  ) : (
                    <form onSubmit={handleReviewSubmit} className="space-y-4">
                      {myPlatformReview && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-800">
                          Latest review submitted on {formatDateTime(myPlatformReview.created_at)}.
                          {myPlatformReview?.is_featured ? " It is currently featured on landing page." : " Submit below to add a new testimonial entry."}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rating</label>
                        <div className="flex items-center gap-1.5">
                          {Array.from({ length: 5 }).map((_, index) => {
                            const starValue = index + 1;
                            const active = starValue <= Number(reviewForm.rating || 0);
                            return (
                              <button
                                key={`review-star-${starValue}`}
                                type="button"
                                onClick={() => {
                                  setReviewForm((prev) => ({ ...prev, rating: starValue }));
                                  if (reviewSubmitType !== "idle") {
                                    setReviewSubmitType("idle");
                                    setReviewSubmitMessage("");
                                  }
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-gold/10"
                                aria-label={`Rate ${starValue} out of 5`}
                              >
                                <Star className={`h-5 w-5 ${active ? "text-gold fill-gold" : "text-gray-300"}`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Your Review</label>
                        <textarea
                          rows={4}
                          value={reviewForm.reviewText}
                          onChange={(event) => {
                            setReviewForm((prev) => ({ ...prev, reviewText: event.target.value }));
                            if (reviewSubmitType !== "idle") {
                              setReviewSubmitType("idle");
                              setReviewSubmitMessage("");
                            }
                          }}
                          placeholder="Share your trekking experience with OffTrail Nepal (minimum 20 characters)."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold resize-y"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location (Optional)</label>
                        <input
                          type="text"
                          value={reviewForm.reviewerLocation}
                          onChange={(event) => {
                            setReviewForm((prev) => ({ ...prev, reviewerLocation: event.target.value }));
                            if (reviewSubmitType !== "idle") {
                              setReviewSubmitType("idle");
                              setReviewSubmitMessage("");
                            }
                          }}
                          placeholder="City, Country"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-[11px] text-gray-500">
                          Each submit creates a new review entry. Admin can select any for landing page cards.
                        </p>
                        <button
                          type="submit"
                          disabled={!canSubmitReview || isSubmittingReview}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-navy bg-gradient-to-r from-gold to-[#D4A43A] shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                          {isSubmittingReview ? "Saving..." : "Submit Testimonial"}
                        </button>
                      </div>

                      {reviewSubmitType !== "idle" && (
                        <div
                          className={`rounded-xl border px-3.5 py-2.5 text-sm ${
                            reviewSubmitType === "success"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : "bg-red-50 border-red-200 text-red-700"
                          }`}
                        >
                          {reviewSubmitMessage}
                        </div>
                      )}
                    </form>
                  )}
                </>
              )}
            </div>
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
