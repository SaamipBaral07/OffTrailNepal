// ╔═══════════════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║                                      API CALLS IN THIS PAGE                                            ║
// ╠═══════════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ GET /api/trails                          → trailRoutes.js        → trailController.getAllTrails        
// ║ GET /api/homestays/admin/all            → homestayRoutes.js     → homestayController.getAllHomestaysForAdmin 
// ║ GET /api/guides/admin/all               → guideRoutes.js        → guideController.getAdminAllGuides   
// ║ GET /api/bookings/admin/payments        → bookingRoutes.js      → bookingController.getAdminBookingPayments
// ║ GET /api/guide-bookings/admin/payments  → guideBookingRoutes.js → guideBookingController.getAdminGuideBookingPayments
// ║ GET /api/contact/enquiries/admin        → contactRoutes.js      → contactController.getContactEnquiriesForAdmin
// ╚═══════════════════════════════════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  RefreshCw,
  Download,
  Home,
  Compass,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Shield,
  LogOut,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../tokenStore";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import LogoutModal from "../components/LogoutModal";

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizedPaymentState = (record) => {
  const paymentStatus = String(record?.payment_status || "").trim().toLowerCase();
  const refundStatus = String(record?.refund_status || "").trim().toLowerCase();

  if (["requested", "processing", "processed", "refunded"].includes(refundStatus)) {
    return "refund";
  }

  if (["refund_requested", "refunded"].includes(paymentStatus)) {
    return "refund";
  }

  if (paymentStatus === "success") {
    return "success";
  }

  if (["pending", "initiated", "processing", "created"].includes(paymentStatus)) {
    return "pending";
  }

  return "failed";
};

const toRecordDateKey = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizedPaymentProvider = (record) => {
  const provider = String(record?.payment_provider || "").trim().toLowerCase();
  if (provider.includes("esewa")) return "esewa";
  if (provider.includes("stripe")) return "stripe";
  return provider || "unknown";
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
  });

const cardAnimation = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [analytics, setAnalytics] = useState({
    trails: [],
    homestays: [],
    guides: [],
    homestayPayments: {
      records: [],
      summary: {
        total_sessions: 0,
        successful_count: 0,
        pending_refunds: 0,
        settled_volume: 0,
      },
    },
    guidePayments: {
      records: [],
      summary: {
        total_sessions: 0,
        successful_count: 0,
        pending_refunds: 0,
        settled_volume: 0,
      },
    },
    contact: {
      enquiries: [],
      summary: {
        total_records: 0,
        last_24h: 0,
        booking_related: 0,
        replied_count: 0,
        pending_reply_count: 0,
      },
    },
  });

  const fetchAnalytics = useCallback(async (asRefresh = false) => {
    if (asRefresh) {
      setRefreshing(true);
    } else {
      setPageLoading(true);
    }

    setError("");

    const [
      trailsRes,
      homestaysRes,
      guidesRes,
      homestayPaymentsRes,
      guidePaymentsRes,
      contactRes,
    ] = await Promise.allSettled([
      api.get("/api/trails"),
      api.get("/api/homestays/admin/all"),
      api.get("/api/guides/admin/all"),
      api.get("/api/bookings/admin/payments", { params: { page: 1, limit: 50 } }),
      api.get("/api/guide-bookings/admin/payments", { params: { page: 1, limit: 50 } }),
      api.get("/api/contact/enquiries/admin", { params: { page: 1, limit: 20 } }),
    ]);

    const failedCalls = [
      trailsRes,
      homestaysRes,
      guidesRes,
      homestayPaymentsRes,
      guidePaymentsRes,
      contactRes,
    ].filter((result) => result.status === "rejected").length;

    if (failedCalls === 6) {
      setError("Could not load analytics data right now. Please try again.");
    } else if (failedCalls > 0) {
      setError("Some analytics sources could not be loaded. Showing partial data.");
    }

    setAnalytics({
      trails:
        trailsRes.status === "fulfilled"
          ? Array.isArray(trailsRes.value?.data?.trails)
            ? trailsRes.value.data.trails
            : []
          : [],
      homestays:
        homestaysRes.status === "fulfilled"
          ? Array.isArray(homestaysRes.value?.data?.homestays)
            ? homestaysRes.value.data.homestays
            : []
          : [],
      guides:
        guidesRes.status === "fulfilled"
          ? Array.isArray(guidesRes.value?.data?.guides)
            ? guidesRes.value.data.guides
            : []
          : [],
      homestayPayments:
        homestayPaymentsRes.status === "fulfilled"
          ? {
              records: Array.isArray(homestayPaymentsRes.value?.data?.records)
                ? homestayPaymentsRes.value.data.records
                : [],
              summary: {
                total_sessions: toNumber(homestayPaymentsRes.value?.data?.summary?.total_sessions),
                successful_count: toNumber(homestayPaymentsRes.value?.data?.summary?.successful_count),
                pending_refunds: toNumber(homestayPaymentsRes.value?.data?.summary?.pending_refunds),
                settled_volume: toNumber(homestayPaymentsRes.value?.data?.summary?.settled_volume),
              },
            }
          : {
              records: [],
              summary: {
                total_sessions: 0,
                successful_count: 0,
                pending_refunds: 0,
                settled_volume: 0,
              },
            },
      guidePayments:
        guidePaymentsRes.status === "fulfilled"
          ? {
              records: Array.isArray(guidePaymentsRes.value?.data?.records)
                ? guidePaymentsRes.value.data.records
                : [],
              summary: {
                total_sessions: toNumber(guidePaymentsRes.value?.data?.summary?.total_sessions),
                successful_count: toNumber(guidePaymentsRes.value?.data?.summary?.successful_count),
                pending_refunds: toNumber(guidePaymentsRes.value?.data?.summary?.pending_refunds),
                settled_volume: toNumber(guidePaymentsRes.value?.data?.summary?.settled_volume),
              },
            }
          : {
              records: [],
              summary: {
                total_sessions: 0,
                successful_count: 0,
                pending_refunds: 0,
                settled_volume: 0,
              },
            },
      contact:
        contactRes.status === "fulfilled"
          ? {
              enquiries: Array.isArray(contactRes.value?.data?.enquiries)
                ? contactRes.value.data.enquiries
                : [],
              summary: {
                total_records: toNumber(contactRes.value?.data?.summary?.total_records),
                last_24h: toNumber(contactRes.value?.data?.summary?.last_24h),
                booking_related: toNumber(contactRes.value?.data?.summary?.booking_related),
                replied_count: toNumber(contactRes.value?.data?.summary?.replied_count),
                pending_reply_count: toNumber(contactRes.value?.data?.summary?.pending_reply_count),
              },
            }
          : {
              enquiries: [],
              summary: {
                total_records: 0,
                last_24h: 0,
                booking_related: 0,
                replied_count: 0,
                pending_reply_count: 0,
              },
            },
    });

    setLastUpdated(new Date());
    setRefreshing(false);
    setPageLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!getToken() || !authUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (authUser.user_type !== "admin") {
      navigate("/", { replace: true });
      return;
    }

    fetchAnalytics(false);
  }, [authLoading, authUser, navigate, fetchAnalytics]);

  const pendingHomestays = useMemo(
    () => analytics.homestays.filter((item) => item.verified_status === "pending").length,
    [analytics.homestays]
  );

  const approvedHomestays = useMemo(
    () => analytics.homestays.filter((item) => item.verified_status === "approved").length,
    [analytics.homestays]
  );

  const rejectedHomestays = useMemo(
    () => analytics.homestays.filter((item) => item.verified_status === "rejected").length,
    [analytics.homestays]
  );

  const pendingGuides = useMemo(
    () => analytics.guides.filter((item) => item.verification_status === "pending").length,
    [analytics.guides]
  );

  const approvedGuides = useMemo(
    () => analytics.guides.filter((item) => item.verification_status === "approved").length,
    [analytics.guides]
  );

  const rejectedGuides = useMemo(
    () => analytics.guides.filter((item) => item.verification_status === "rejected").length,
    [analytics.guides]
  );

  const totalPendingRefunds =
    toNumber(analytics.homestayPayments.summary.pending_refunds) +
    toNumber(analytics.guidePayments.summary.pending_refunds);

  const unresolvedOperationalAlerts =
    pendingHomestays + pendingGuides + totalPendingRefunds + toNumber(analytics.contact.summary.pending_reply_count);

  const allPaymentRecords = useMemo(
    () => [
      ...analytics.homestayPayments.records.map((record) => ({
        ...record,
        booking_type: "homestay",
      })),
      ...analytics.guidePayments.records.map((record) => ({
        ...record,
        booking_type: "guide",
      })),
    ],
    [analytics.homestayPayments.records, analytics.guidePayments.records]
  );

  const filteredPaymentRecords = useMemo(
    () =>
      allPaymentRecords.filter((record) => {
        const paymentState = normalizedPaymentState(record);
        const provider = normalizedPaymentProvider(record);
        const recordDateKey = toRecordDateKey(
          record?.verified_at || record?.payment_initiated_at || record?.created_at
        );

        if (statusFilter !== "all" && paymentState !== statusFilter) {
          return false;
        }

        if (providerFilter !== "all" && provider !== providerFilter) {
          return false;
        }

        if (dateFrom && (!recordDateKey || recordDateKey < dateFrom)) {
          return false;
        }

        if (dateTo && (!recordDateKey || recordDateKey > dateTo)) {
          return false;
        }

        return true;
      }),
    [allPaymentRecords, dateFrom, dateTo, providerFilter, statusFilter]
  );

  const filteredPaymentSessions = filteredPaymentRecords.length;
  const filteredSuccessfulPayments = filteredPaymentRecords.filter(
    (record) => normalizedPaymentState(record) === "success"
  ).length;
  const filteredRevenue = filteredPaymentRecords
    .filter((record) => normalizedPaymentState(record) === "success")
    .reduce((sum, record) => sum + toNumber(record?.total_amount ?? record?.amount), 0);

  const paymentSuccessRate =
    filteredPaymentSessions > 0
      ? Math.round((filteredSuccessfulPayments / filteredPaymentSessions) * 100)
      : 0;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setProviderFilter("all");
    setStatusFilter("all");
  };

  const handleExportCsv = () => {
    if (!filteredPaymentRecords.length) {
      window.alert("No payment records available for the selected filters.");
      return;
    }

    const headers = [
      "booking_type",
      "booking_id",
      "booking_code",
      "payment_provider",
      "payment_status",
      "refund_status",
      "payment_state",
      "total_amount",
      "payment_initiated_at",
      "verified_at",
      "tourist_name",
      "tourist_email",
      "counterparty_name",
      "counterparty_email",
      "service_or_property",
    ];

    const escapeCsv = (value) => {
      const stringified = String(value ?? "");
      if (/[",\n]/.test(stringified)) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const rows = filteredPaymentRecords.map((record) => ({
      booking_type: record.booking_type,
      booking_id: record.booking_id ?? "",
      booking_code: record.booking_code ?? "",
      payment_provider: normalizedPaymentProvider(record),
      payment_status: record.payment_status ?? "",
      refund_status: record.refund_status ?? "",
      payment_state: normalizedPaymentState(record),
      total_amount: toNumber(record.total_amount ?? record.amount),
      payment_initiated_at: record.payment_initiated_at ?? record.created_at ?? "",
      verified_at: record.verified_at ?? "",
      tourist_name: record.tourist_name ?? "",
      tourist_email: record.tourist_email ?? "",
      counterparty_name: record.host_name ?? record.guide_name ?? "",
      counterparty_email: record.host_email ?? record.guide_email ?? "",
      service_or_property: record.homestay_name ?? record.service_title ?? "",
    }));

    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const fromPart = dateFrom || "start";
    const toPart = dateTo || "today";
    anchor.href = url;
    anchor.download = `admin-payment-report-${fromPart}-to-${toPart}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    setExportingPdf(true);

    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const contentWidth = pageWidth - margin * 2;
      const sectionGap = 4;
      const palette = {
        navy: [12, 35, 64],
        gray700: [55, 65, 81],
        gray500: [107, 114, 128],
        gray200: [229, 231, 235],
        cardBg: [248, 250, 252],
      };

      const formatNpr = (value) => `NPR ${toNumber(value).toLocaleString("en-US")}`;
      const providerLabel =
        providerFilter === "all"
          ? "All Providers"
          : providerFilter === "esewa"
          ? "eSewa"
          : providerFilter === "stripe"
          ? "Stripe"
          : "Unknown";
      const statusLabel =
        statusFilter === "all"
          ? "All States"
          : statusFilter === "success"
          ? "Successful"
          : statusFilter === "pending"
          ? "Pending"
          : statusFilter === "refund"
          ? "Refund"
          : "Failed";

      const drawCard = (x, y, w, h, title, value, subtitle, valueColor = palette.navy) => {
        pdf.setFillColor(...palette.cardBg);
        pdf.setDrawColor(...palette.gray200);
        pdf.roundedRect(x, y, w, h, 2.5, 2.5, "FD");

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.setTextColor(...palette.gray500);
        pdf.text(String(title || "-"), x + 3, y + 4.8);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(...valueColor);
        pdf.text(String(value || "-"), x + 3, y + 12.5);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...palette.gray500);
        pdf.text(String(subtitle || ""), x + 3, y + h - 3.2);
      };

      let y = margin;

      // Header
      pdf.setFillColor(...palette.navy);
      pdf.roundedRect(margin, y, contentWidth, 24, 3, 3, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(15);
      pdf.setTextColor(255, 255, 255);
      pdf.text("OffTrail Admin Analytics Report", margin + 5, y + 8.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(230, 236, 245);
      pdf.text(
        `Generated: ${new Date().toLocaleString("en-US")}  |  Last dashboard refresh: ${
          lastUpdated ? lastUpdated.toLocaleString("en-US") : "-"
        }`,
        margin + 5,
        y + 14.2
      );
      pdf.text("One-page executive snapshot of current filtered analytics", margin + 5, y + 19.2);

      y += 24 + sectionGap;

      // Filter summary strip
      pdf.setFillColor(245, 247, 250);
      pdf.setDrawColor(...palette.gray200);
      pdf.roundedRect(margin, y, contentWidth, 11, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...palette.gray700);
      pdf.text("Active Filters", margin + 3, y + 4.6);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...palette.gray500);
      pdf.text(
        `Date: ${dateFrom || "Start"} to ${dateTo || "Today"}    Provider: ${providerLabel}    Status: ${statusLabel}`,
        margin + 3,
        y + 8.5
      );

      y += 11 + sectionGap;

      // KPI cards row
      const kpiGap = 3;
      const kpiWidth = (contentWidth - kpiGap * 3) / 4;
      const kpiHeight = 24;
      const kpis = [
        {
          title: "Filtered Revenue",
          value: formatNpr(filteredRevenue),
          subtitle: "From successful filtered sessions",
          valueColor: [12, 35, 64],
        },
        {
          title: "Payment Success",
          value: `${paymentSuccessRate}%`,
          subtitle: `${filteredSuccessfulPayments} of ${filteredPaymentSessions} sessions`,
          valueColor: [6, 95, 70],
        },
        {
          title: "Communication Queue",
          value: `${toNumber(analytics.contact.summary.pending_reply_count)}`,
          subtitle: "Pending enquiry replies",
          valueColor: [55, 65, 81],
        },
        {
          title: "Operational Alerts",
          value: `${unresolvedOperationalAlerts}`,
          subtitle: "Approvals, refunds, and replies",
          valueColor: [185, 28, 28],
        },
      ];

      kpis.forEach((item, index) => {
        drawCard(
          margin + (kpiWidth + kpiGap) * index,
          y,
          kpiWidth,
          kpiHeight,
          item.title,
          item.value,
          item.subtitle,
          item.valueColor
        );
      });

      y += kpiHeight + sectionGap;

      // Middle row (verification + payment health)
      const middleLeftWidth = 176;
      const middleHeight = 53;
      const middleRightX = margin + middleLeftWidth + sectionGap;
      const middleRightWidth = contentWidth - middleLeftWidth - sectionGap;

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...palette.gray200);
      pdf.roundedRect(margin, y, middleLeftWidth, middleHeight, 2.5, 2.5, "FD");
      pdf.roundedRect(middleRightX, y, middleRightWidth, middleHeight, 2.5, 2.5, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...palette.navy);
      pdf.text("Verification Pipeline", margin + 3, y + 6);
      pdf.text("Payment Health", middleRightX + 3, y + 6);

      const barColors = {
        pending: [217, 119, 6],
        approved: [5, 150, 105],
        rejected: [220, 38, 38],
      };

      verificationRows.forEach((row, index) => {
        const rowBaseY = y + 12 + index * 20;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(...palette.gray700);
        pdf.text(row.label, margin + 3, rowBaseY);

        const barBaseX = margin + 30;
        const barTrackW = 105;
        const metrics = [
          { key: "pending", value: row.pending },
          { key: "approved", value: row.approved },
          { key: "rejected", value: row.rejected },
        ];

        metrics.forEach((metric, metricIndex) => {
          const lineY = rowBaseY + 3.8 + metricIndex * 4.5;
          const ratio = verificationPeak > 0 ? metric.value / verificationPeak : 0;
          const barW = Math.max(barTrackW * ratio, metric.value > 0 ? 3 : 0);

          pdf.setFillColor(243, 244, 246);
          pdf.roundedRect(barBaseX, lineY - 1.4, barTrackW, 2.3, 1.1, 1.1, "F");
          pdf.setFillColor(...barColors[metric.key]);
          if (barW > 0) {
            pdf.roundedRect(barBaseX, lineY - 1.4, barW, 2.3, 1.1, 1.1, "F");
          }

          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.setTextColor(...palette.gray500);
          pdf.text(`${metric.key[0].toUpperCase()}${metric.key.slice(1)} ${metric.value}`, barBaseX + barTrackW + 3, lineY);
        });
      });

      const paymentTotal = Math.max(
        paymentMix.reduce((sum, segment) => sum + toNumber(segment.value), 0),
        1
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(15, 118, 110);
      pdf.text(`${paymentSuccessRate}%`, middleRightX + 4, y + 15);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.3);
      pdf.setTextColor(...palette.gray500);
      pdf.text("overall success rate", middleRightX + 24, y + 14.8);

      paymentMix.forEach((segment, index) => {
        const segY = y + 23 + index * 7;
        const ratio = toNumber(segment.value) / paymentTotal;
        const trackX = middleRightX + 34;
        const trackW = middleRightWidth - 42;
        const fillW = Math.max(trackW * ratio, segment.value > 0 ? 2 : 0);

        const color = String(segment.color || "#475569").replace("#", "");
        const rgb = [
          Number.parseInt(color.slice(0, 2), 16),
          Number.parseInt(color.slice(2, 4), 16),
          Number.parseInt(color.slice(4, 6), 16),
        ];

        pdf.setFillColor(...rgb);
        pdf.circle(middleRightX + 6.5, segY - 0.8, 1.1, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.2);
        pdf.setTextColor(...palette.gray700);
        pdf.text(segment.label, middleRightX + 9.5, segY);

        pdf.setFillColor(243, 244, 246);
        pdf.roundedRect(trackX, segY - 1.5, trackW, 2.4, 1, 1, "F");
        if (fillW > 0) {
          pdf.setFillColor(...rgb);
          pdf.roundedRect(trackX, segY - 1.5, fillW, 2.4, 1, 1, "F");
        }
        pdf.setFontSize(7.1);
        pdf.setTextColor(...palette.gray500);
        pdf.text(`${toNumber(segment.value)}`, trackX + trackW + 1.8, segY);
      });

      y += middleHeight + sectionGap;

      // Bottom row (revenue trend + contact)
      const bottomHeight = 53;
      const bottomLeftWidth = 176;
      const bottomRightX = margin + bottomLeftWidth + sectionGap;
      const bottomRightWidth = contentWidth - bottomLeftWidth - sectionGap;

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(...palette.gray200);
      pdf.roundedRect(margin, y, bottomLeftWidth, bottomHeight, 2.5, 2.5, "FD");
      pdf.roundedRect(bottomRightX, y, bottomRightWidth, bottomHeight, 2.5, 2.5, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...palette.navy);
      pdf.text("6-Month Revenue Trend", margin + 3, y + 6);
      pdf.text("Contact & Inventory Snapshot", bottomRightX + 3, y + 6);

      const chartX = margin + 8;
      const chartY = y + 12;
      const chartH = 30;
      const chartW = bottomLeftWidth - 14;
      const barGap = 5;
      const monthCount = Math.max(revenueSeries.length, 1);
      const barWidth = (chartW - barGap * (monthCount - 1)) / monthCount;

      pdf.setDrawColor(226, 232, 240);
      pdf.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

      revenueSeries.forEach((point, index) => {
        const amount = toNumber(point.total);
        const ratio = maxRevenuePoint > 0 ? amount / maxRevenuePoint : 0;
        const barH = Math.max(chartH * ratio, amount > 0 ? 2 : 0);
        const barX = chartX + index * (barWidth + barGap);
        const barY = chartY + chartH - barH;

        pdf.setFillColor(30, 76, 118);
        pdf.roundedRect(barX, barY, barWidth, barH, 1, 1, "F");

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(...palette.gray500);
        pdf.text(point.label, barX + barWidth / 2, chartY + chartH + 4.6, { align: "center" });
        pdf.text(`${Math.round(amount / 1000)}k`, barX + barWidth / 2, chartY + chartH + 8.3, { align: "center" });
      });

      const statRows = [
        ["Total enquiries", `${toNumber(analytics.contact.summary.total_records)}`],
        ["Reply rate", `${replyRate}%`],
        ["Pending reply", `${toNumber(analytics.contact.summary.pending_reply_count)}`],
        ["Booking-related enquiries", `${toNumber(analytics.contact.summary.booking_related)}`],
        ["Total trails", `${analytics.trails.length}`],
        ["Homestay / Guide sessions", `${toNumber(analytics.homestayPayments.summary.total_sessions)} / ${toNumber(analytics.guidePayments.summary.total_sessions)}`],
      ];

      statRows.forEach((row, index) => {
        const rowY = y + 12 + index * 6.5;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.8);
        pdf.setTextColor(...palette.gray500);
        pdf.text(row[0], bottomRightX + 3, rowY);

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...palette.gray700);
        pdf.text(row[1], bottomRightX + bottomRightWidth - 3, rowY, { align: "right" });
      });

      // Footer note
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(...palette.gray500);
      pdf.text(
        "This one-page report is generated from currently applied filters and live dashboard data.",
        margin,
        pageHeight - 4
      );

      const fromPart = dateFrom || "start";
      const toPart = dateTo || "today";
      pdf.save(`admin-analytics-report-one-page-${fromPart}-to-${toPart}.pdf`);
    } catch (pdfError) {
      console.error("PDF export failed:", pdfError);
      window.alert("Failed to export PDF report. Please try again.");
    } finally {
      setExportingPdf(false);
    }
  };

  const paymentMix = useMemo(() => {
    const counts = {
      success: 0,
      pending: 0,
      refund: 0,
      failed: 0,
    };

    filteredPaymentRecords.forEach((record) => {
      const state = normalizedPaymentState(record);
      counts[state] += 1;
    });

    return [
      { label: "Successful", value: counts.success, color: "#0f766e" },
      { label: "Pending", value: counts.pending, color: "#d97706" },
      { label: "Refund", value: counts.refund, color: "#dc2626" },
      { label: "Failed", value: counts.failed, color: "#475569" },
    ];
  }, [filteredPaymentRecords]);

  const donutFillStyle = useMemo(() => {
    const total = paymentMix.reduce((sum, segment) => sum + segment.value, 0);
    if (total <= 0) {
      return "conic-gradient(#e2e8f0 0% 100%)";
    }

    let cursor = 0;
    const slices = paymentMix
      .map((segment) => {
        const from = cursor;
        const pct = (segment.value / total) * 100;
        cursor += pct;
        return `${segment.color} ${from.toFixed(2)}% ${cursor.toFixed(2)}%`;
      })
      .join(", ");

    return `conic-gradient(${slices})`;
  }, [paymentMix]);

  const revenueSeries = useMemo(() => {
    const now = new Date();
    const months = [];

    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      months.push({ key: monthKey(date), label: monthLabel(date), total: 0 });
    }

    const index = months.reduce((acc, item, idx) => {
      acc[item.key] = idx;
      return acc;
    }, {});

    filteredPaymentRecords.forEach((record) => {
      if (String(record?.payment_status || "").trim().toLowerCase() !== "success") return;

      const sourceDate = record?.verified_at || record?.payment_initiated_at || record?.created_at;
      if (!sourceDate) return;

      const parsedDate = new Date(sourceDate);
      if (Number.isNaN(parsedDate.getTime())) return;

      const key = monthKey(parsedDate);
      if (index[key] === undefined) return;

      const amount = toNumber(record?.total_amount ?? record?.amount);
      months[index[key]].total += amount;
    });

    return months;
  }, [filteredPaymentRecords]);

  const maxRevenuePoint = useMemo(
    () => Math.max(...revenueSeries.map((item) => item.total), 1),
    [revenueSeries]
  );

  const verificationRows = [
    {
      label: "Homestays",
      icon: Home,
      pending: pendingHomestays,
      approved: approvedHomestays,
      rejected: rejectedHomestays,
    },
    {
      label: "Guides",
      icon: Compass,
      pending: pendingGuides,
      approved: approvedGuides,
      rejected: rejectedGuides,
    },
  ];

  const verificationPeak = Math.max(
    ...verificationRows.map((row) => Math.max(row.pending, row.approved, row.rejected)),
    1
  );

  const replyRate =
    toNumber(analytics.contact.summary.total_records) > 0
      ? Math.round(
          (toNumber(analytics.contact.summary.replied_count) /
            toNumber(analytics.contact.summary.total_records)) *
            100
        )
      : 0;

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="inline-flex items-center gap-3 text-gray-600 text-sm font-medium">
          <Loader2 className="h-5 w-5 animate-spin text-navy" />
          Loading admin analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-body">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 space-y-7">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl border border-navy/10 bg-gradient-to-br from-navy via-navy-light to-[#132447] text-white shadow-[0_18px_45px_rgba(15,23,42,0.24)] overflow-hidden"
        >
          <div className="px-6 sm:px-8 py-6 sm:py-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-gold text-[11px] tracking-[0.24em] uppercase font-bold">Admin Intelligence</p>
              <h1 className="text-2xl sm:text-3xl font-heading font-bold mt-2">Reporting and Analysis Dashboard</h1>
              <p className="text-white/75 text-sm mt-2 max-w-2xl">
                Live operational reporting for approvals, payments, revenue trend, and communication workload.
              </p>
              <p className="text-white/60 text-xs mt-4">
                Last updated: {lastUpdated ? lastUpdated.toLocaleString("en-US") : "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link
                to="/admin-dashboard"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin
              </Link>
              <Link
                to="/admin-profile"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
              >
                <Shield className="h-4 w-4" />
                Profile
              </Link>
              <button
                type="button"
                onClick={() => fetchAnalytics(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gold/50 bg-gold text-navy text-sm font-bold hover:bg-[#f7c95c] transition-colors disabled:opacity-70"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                type="button"
                onClick={setShowLogoutModal}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-300/50 bg-red-50/95 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 text-sm font-medium">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Payment Filters</p>
              <p className="text-sm text-gray-600 mt-1">
                Narrow down charts and revenue insights by date, provider, and status.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300/60 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-70"
              >
                {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportingPdf ? "Generating PDF..." : "Export PDF"}
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-navy/20 bg-navy text-white text-sm font-semibold hover:bg-navy-light transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <label className="text-xs font-semibold text-gray-600">
              Date From
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </label>

            <label className="text-xs font-semibold text-gray-600">
              Date To
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
              />
            </label>

            <label className="text-xs font-semibold text-gray-600">
              Provider
              <select
                value={providerFilter}
                onChange={(event) => setProviderFilter(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
              >
                <option value="all">All Providers</option>
                <option value="esewa">eSewa</option>
                <option value="stripe">Stripe</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-gray-600">
              Status
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy/20"
              >
                <option value="all">All States</option>
                <option value="success">Successful</option>
                <option value="pending">Pending</option>
                <option value="refund">Refund</option>
                <option value="failed">Failed</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.article {...cardAnimation} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Filtered Revenue</p>
            <p className="text-2xl font-heading text-navy font-bold mt-2">NPR {filteredRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">From filtered successful sessions</p>
          </motion.article>
          <motion.article {...cardAnimation} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Payment Success</p>
            <p className="text-2xl font-heading text-alpine-dark font-bold mt-2">{paymentSuccessRate}%</p>
            <p className="text-xs text-gray-500 mt-2">{filteredSuccessfulPayments} successful of {filteredPaymentSessions} filtered sessions</p>
          </motion.article>
          <motion.article {...cardAnimation} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Communication Queue</p>
            <p className="text-2xl font-heading text-charcoal font-bold mt-2">{toNumber(analytics.contact.summary.pending_reply_count)}</p>
            <p className="text-xs text-gray-500 mt-2">Pending enquiry replies</p>
          </motion.article>
          <motion.article {...cardAnimation} className="rounded-2xl bg-white border border-gray-200 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Operational Alerts</p>
            <p className="text-2xl font-heading text-red-700 font-bold mt-2">{unresolvedOperationalAlerts}</p>
            <p className="text-xs text-gray-500 mt-2">Pending approvals, refunds, and replies</p>
          </motion.article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <motion.article
            {...cardAnimation}
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-heading text-navy font-bold">Verification Pipeline</h2>
                <p className="text-xs text-gray-500 mt-1">Pending vs approved vs rejected profiles</p>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>

            <div className="space-y-5">
              {verificationRows.map((row) => (
                <div key={row.label} className="rounded-xl border border-gray-100 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <row.icon className="h-4 w-4 text-navy" />
                    <p className="text-sm font-semibold text-gray-800">{row.label}</p>
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { label: "Pending", value: row.pending, color: "bg-amber-500" },
                      { label: "Approved", value: row.approved, color: "bg-emerald-600" },
                      { label: "Rejected", value: row.rejected, color: "bg-red-600" },
                    ].map((item) => (
                      <div key={`${row.label}-${item.label}`} className="grid grid-cols-[82px_1fr_34px] items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full ${item.color} rounded-full`}
                            style={{ width: `${Math.max((item.value / verificationPeak) * 100, item.value > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 text-right">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article
            {...cardAnimation}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-heading text-navy font-bold">Payment Health</h2>
            <p className="text-xs text-gray-500 mt-1">State mix from latest sessions</p>

            <div className="mt-6 flex justify-center">
              <div
                data-pdf-safe-conic="1"
                className="relative h-40 w-40 rounded-full"
                style={{ backgroundImage: donutFillStyle }}
              >
                <div className="absolute inset-[18px] rounded-full bg-white border border-gray-100 flex items-center justify-center text-center">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">Success</p>
                    <p className="text-2xl font-bold text-navy">{paymentSuccessRate}%</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {paymentMix.map((segment) => (
                <div key={segment.label} className="flex items-center justify-between text-sm">
                  <div className="inline-flex items-center gap-2 text-gray-600">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    {segment.label}
                  </div>
                  <span className="font-semibold text-gray-800">{segment.value}</span>
                </div>
              ))}
            </div>
          </motion.article>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <motion.article
            {...cardAnimation}
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-heading text-navy font-bold">6-Month Revenue Trend</h2>
                <p className="text-xs text-gray-500 mt-1">Successful settlements by month (NPR)</p>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>

            <div className="mt-6 grid grid-cols-6 gap-3 items-end h-48">
              {revenueSeries.map((point) => {
                const barHeight = Math.max((point.total / maxRevenuePoint) * 100, point.total > 0 ? 6 : 0);
                return (
                  <div key={point.key} className="flex flex-col items-center gap-2">
                    <div className="w-full flex items-end justify-center h-36 bg-gradient-to-b from-[#f5f7fb] to-[#fbfcff] border border-gray-100 rounded-lg p-2">
                      <div
                        className="w-8 rounded-md bg-gradient-to-t from-navy to-alpine"
                        style={{ height: `${barHeight}%` }}
                        title={`NPR ${point.total.toLocaleString()}`}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-gray-600">{point.label}</p>
                    <p className="text-[11px] text-gray-400">{point.total > 0 ? `${Math.round(point.total / 1000)}k` : "0"}</p>
                  </div>
                );
              })}
            </div>
          </motion.article>

          <motion.article
            {...cardAnimation}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-lg font-heading text-navy font-bold">Contact Performance</h2>
            <p className="text-xs text-gray-500 mt-1">Admin communication and response ratio</p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <MessageSquare className="h-4 w-4 text-navy" />
                  Total Enquiries
                </div>
                <span className="font-semibold text-gray-800">{toNumber(analytics.contact.summary.total_records)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Replied
                </div>
                <span className="font-semibold text-gray-800">{toNumber(analytics.contact.summary.replied_count)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Pending Reply
                </div>
                <span className="font-semibold text-gray-800">{toNumber(analytics.contact.summary.pending_reply_count)}</span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>Reply Rate</span>
                <span>{replyRate}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-navy to-alpine" style={{ width: `${replyRate}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 mt-2">Booking-related enquiries: {toNumber(analytics.contact.summary.booking_related)}</p>
            </div>
          </motion.article>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Total Trails</p>
            <p className="text-2xl font-heading text-navy font-bold mt-1">{analytics.trails.length}</p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Homestay Sessions</p>
            <p className="text-2xl font-heading text-navy font-bold mt-1">{toNumber(analytics.homestayPayments.summary.total_sessions)}</p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-gray-500 font-bold">Guide Sessions</p>
            <p className="text-2xl font-heading text-navy font-bold mt-1">{toNumber(analytics.guidePayments.summary.total_sessions)}</p>
          </article>
        </section>
      </main>

      <LogoutModal
        isOpen={showLogoutModal}
        onConfirm={handleLogout}
        onCancel={handleStayLoggedIn}
      />
    </div>
  );
};

export default AdminAnalytics;
