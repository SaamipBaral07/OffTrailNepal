// ╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║                                                                       
// ╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
// ║ GET /api/invoices/:bookingType/:bookingId → invoiceRoutes.js → invoiceController.getTouristInvoice ║
// ╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Download, ArrowLeft, Copy, ReceiptText } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import { downloadInvoicePdfFile, formatInvoiceDate, formatMoney } from "../utils/invoicePdf";

const normalizeBookingType = (value) => {
  const cleaned = String(value || "").trim().toLowerCase();
  if (["guide", "guide_package", "guide-package"].includes(cleaned)) {
    return "guide_package";
  }
  if (cleaned === "homestay") {
    return "homestay";
  }
  return "";
};

const InvoicePage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const { user, loading } = useAuth();

  const normalizedBookingType = useMemo(
    () => normalizeBookingType(params.bookingType),
    [params.bookingType]
  );
  const bookingId = Number.parseInt(String(params.bookingId || ""), 10);

  const [invoice, setInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [invoiceError, setInvoiceError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copyState, setCopyState] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!normalizedBookingType || !Number.isInteger(bookingId) || bookingId <= 0) {
        setInvoiceError("Invalid invoice URL. Please check the booking type and id.");
        setLoadingInvoice(false);
        return;
      }

      setLoadingInvoice(true);
      setInvoiceError("");
      try {
        const res = await api.get(`/api/invoices/${normalizedBookingType}/${bookingId}`);
        setInvoice(res.data?.invoice || null);
      } catch (err) {
        setInvoiceError(err.response?.data?.message || "Unable to load invoice");
      } finally {
        setLoadingInvoice(false);
      }
    };

    if (!loading) {
      if (!user || user.user_type !== "tourist") {
        navigate("/login", { replace: true });
        return;
      }
      fetchInvoice();
    }
  }, [bookingId, loading, navigate, normalizedBookingType, user]);

  const shareLink = useMemo(() => {
    if (!invoice?.booking_type || !invoice?.booking_id) return "";
    return `${window.location.origin}/invoice/${invoice.booking_type}/${invoice.booking_id}`;
  }, [invoice]);

  const handleDownload = async () => {
    if (!invoice) return;
    setDownloading(true);
    try {
      await downloadInvoicePdfFile(invoice);
    } finally {
      setDownloading(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyState("copied");
      window.setTimeout(() => setCopyState(""), 1800);
    } catch (_error) {
      setCopyState("failed");
      window.setTimeout(() => setCopyState(""), 1800);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-navy/10 bg-white/95 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyShareLink}
                disabled={!shareLink}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                <Copy className="h-4 w-4" />
                {copyState === "copied" ? "Link Copied" : copyState === "failed" ? "Copy Failed" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading || !invoice}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2 text-sm font-bold text-navy disabled:opacity-60"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download PDF
              </button>
            </div>
          </div>

          {loadingInvoice && (
            <div className="min-h-[280px] flex items-center justify-center text-gray-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading invoice...
            </div>
          )}

          {!loadingInvoice && invoiceError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
              <p className="font-semibold">Could not open invoice</p>
              <p className="text-sm mt-1">{invoiceError}</p>
              <Link
                to="/my-bookings"
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-semibold hover:bg-red-100"
              >
                <ReceiptText className="h-4 w-4" />
                Go to My Bookings
              </Link>
            </div>
          )}

          {!loadingInvoice && invoice && (
            <>
              <div className="rounded-3xl overflow-hidden border border-navy/20 bg-white">
                <div className="bg-gradient-to-r from-[#0C2340] via-[#163A5F] to-[#0C2340] px-6 py-5 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 rounded-full overflow-hidden border border-gold/40 bg-white/90 p-1">
                        <img
                          src={invoice.issuer?.logo_path || "/offtrail-latest.png"}
                          alt="OffTrail Nepal"
                          className="h-full w-full rounded-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-gold/90 font-semibold">Official Invoice</p>
                        <h1 className="text-2xl font-heading font-bold leading-tight">{invoice.issuer?.name || "OffTrail Nepal"}</h1>
                        <p className="text-sm text-white/70">{invoice.issuer?.location || "Pokhara, Nepal"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/70">Invoice Number</p>
                      <p className="text-lg font-semibold text-gold/95">{invoice.invoice_number}</p>
                      <p className="text-xs text-white/70 mt-1">Issued on {formatInvoiceDate(invoice.issued_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Billed To</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{invoice.snapshot?.billing_name || "-"}</p>
                      <p className="text-sm text-slate-600 mt-1">{invoice.snapshot?.billing_email || "-"}</p>
                      <p className="text-sm text-slate-600">{invoice.snapshot?.billing_phone || "-"}</p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Booking Summary</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{invoice.snapshot?.listing_name || "-"}</p>
                      <p className="text-sm text-slate-600 mt-1">{invoice.snapshot?.listing_location || "-"}</p>
                      <p className="text-xs text-slate-500 mt-2">Booking Code: {invoice.snapshot?.booking_code || "-"}</p>
                      <p className="text-xs text-slate-500 mt-1 capitalize">Booking Type: {invoice.booking_type === "guide_package" ? "Guide Package" : "Homestay"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="grid grid-cols-2 bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                      <p>Description</p>
                      <p className="text-right">Amount</p>
                    </div>
                    <div className="space-y-0">
                      <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                        <p className="text-slate-700">
                          {invoice.booking_type === "guide_package"
                            ? `${invoice.snapshot?.listing_name || "Guide package"} (${invoice.snapshot?.participants_count || 0} participants)`
                            : `${invoice.snapshot?.listing_name || "Homestay stay"} (${invoice.snapshot?.guests_count ?? invoice.snapshot?.rooms_booked ?? 0} guests, per person/night)`}
                        </p>
                        <p className="text-right font-semibold text-slate-800">{formatMoney(invoice.subtotal_amount, invoice.currency || "NPR")}</p>
                      </div>
                      <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                        <p className="text-slate-700">Tax</p>
                        <p className="text-right text-slate-700">{formatMoney(invoice.tax_amount, invoice.currency || "NPR")}</p>
                      </div>
                      <div className="grid grid-cols-2 px-4 py-3 text-sm border-t border-slate-100">
                        <p className="text-slate-700">Service Charge</p>
                        <p className="text-right text-slate-700">{formatMoney(invoice.service_charge, invoice.currency || "NPR")}</p>
                      </div>
                      <div className="grid grid-cols-2 px-4 py-3 text-base border-t border-slate-200 bg-slate-50/60">
                        <p className="font-bold text-slate-900">Total Paid</p>
                        <p className="text-right font-bold text-slate-900">{formatMoney(invoice.total_amount, invoice.currency || "NPR")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800">
                    <p className="font-semibold">Payment Method: {String(invoice.payment_method || "unknown").toUpperCase()}</p>
                    <p className="mt-1">Payment Status: <span className="font-semibold uppercase">{invoice.payment_status || "unknown"}</span></p>
                    <p className="mt-1">Transaction Reference: <span className="font-semibold">{invoice.payment_reference || "-"}</span></p>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default InvoicePage;
