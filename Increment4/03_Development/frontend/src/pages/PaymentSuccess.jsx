import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CalendarCheck2, Loader2, Home, ReceiptText, AlertTriangle } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const PaymentSuccess = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get("session_token") || "";
  const homestayId = searchParams.get("homestay_id") || "";
  const bookingType = searchParams.get("booking_type") || "homestay";
  const serviceId = searchParams.get("service_id") || "";
  const paymentQueryStatus = String(searchParams.get("payment") || "").trim().toLowerCase();
  const paymentFailureReason = String(searchParams.get("reason") || "").trim();

  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionRecord, setSessionRecord] = useState(null);
  const [sessionError, setSessionError] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceRecord, setInvoiceRecord] = useState(null);
  const [invoiceError, setInvoiceError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionToken || !user || user.user_type !== "tourist") return;

      setSessionLoading(true);
      setSessionError("");
      try {
        const endpoint =
          bookingType === "guide_package"
            ? `/api/guide-bookings/payment/session/${sessionToken}`
            : `/api/bookings/payment/session/${sessionToken}`;
        const res = await api.get(endpoint);
        setSessionRecord(res.data?.payment || null);
      } catch (err) {
        setSessionError(err.response?.data?.message || "Could not load payment details.");
      } finally {
        setSessionLoading(false);
      }
    };

    if (!loading) {
      loadSession();
    }
  }, [bookingType, loading, sessionToken, user]);

  const bookingLabel = bookingType === "guide_package" ? "guide package" : "homestay booking";

  const resolvedPaymentStatus = String(sessionRecord?.payment_status || "").trim().toLowerCase();
  const isFailedByQuery = paymentQueryStatus === "failed";
  const isFailedBySession = ["failed", "expired", "cancelled"].includes(resolvedPaymentStatus);
  const isSuccessBySession = resolvedPaymentStatus === "success";
  const isConfirmedSuccess =
    paymentQueryStatus === "success" && (isSuccessBySession || (!sessionToken && !isFailedByQuery));
  const showFailedState = isFailedByQuery || isFailedBySession || (paymentQueryStatus === "success" && sessionToken && !sessionLoading && !isSuccessBySession);
  const invoiceBookingType = bookingType === "guide_package" ? "guide_package" : "homestay";

  useEffect(() => {
    const generateInvoice = async () => {
      if (!user || user.user_type !== "tourist") return;
      if (!isConfirmedSuccess || !sessionRecord?.booking_id) return;

      setInvoiceLoading(true);
      setInvoiceError("");
      try {
        const res = await api.get(`/api/invoices/${invoiceBookingType}/${sessionRecord.booking_id}`);
        setInvoiceRecord(res.data?.invoice || null);
      } catch (err) {
        setInvoiceError(err.response?.data?.message || "Could not generate invoice yet.");
      } finally {
        setInvoiceLoading(false);
      }
    };

    if (!loading && !sessionLoading) {
      generateInvoice();
    }
  }, [loading, sessionLoading, isConfirmedSuccess, sessionRecord?.booking_id, invoiceBookingType, user]);

  const amountText = useMemo(() => {
    const amountValue = Number(sessionRecord?.total_amount ?? sessionRecord?.amount ?? 0);
    if (!amountValue) return null;
    return `NPR ${amountValue.toLocaleString()}`;
  }, [sessionRecord]);

  const paymentProviderLabel = useMemo(() => {
    const normalizedProvider = String(sessionRecord?.payment_provider || "").trim().toLowerCase();
    if (normalizedProvider === "stripe") return "Stripe";
    if (normalizedProvider === "esewa") return "eSewa";

    const transactionUuid = String(sessionRecord?.transaction_uuid || "").trim().toUpperCase();
    if (transactionUuid.startsWith("STPAY-")) return "Stripe";
    if (transactionUuid.startsWith("ESPAY-")) return "eSewa";

    return "";
  }, [sessionRecord]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-emerald-200 bg-white p-6 sm:p-8 shadow-[0_12px_30px_rgba(12,35,64,0.08)]">
          <div className="flex items-start gap-4">
            <div className={`rounded-2xl p-3 ${showFailedState ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
              {showFailedState ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>
            <div>
              {showFailedState ? (
                <>
                  <p className="text-xs uppercase tracking-[0.18em] text-red-700 font-semibold">Payment Failed</p>
                  <h1 className="text-3xl sm:text-4xl font-heading text-charcoal mt-1">Your booking was not completed</h1>
                  <p className="text-gray-600 mt-2">
                    Your {paymentProviderLabel ? `${paymentProviderLabel} ` : ""}payment did not complete successfully, so no {bookingLabel} was created.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-semibold">Payment Completed</p>
                  <h1 className="text-3xl sm:text-4xl font-heading text-charcoal mt-1">Your booking is confirmed</h1>
                  <p className="text-gray-600 mt-2">
                    Thank you. Your {paymentProviderLabel ? `${paymentProviderLabel} ` : ""}payment was successful and your {bookingLabel} has been finalized.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className={`mt-6 rounded-2xl p-4 space-y-2 ${showFailedState ? "border border-red-200 bg-red-50/70" : "border border-emerald-200 bg-emerald-50/70"}`}>
            <p className={`text-sm font-semibold ${showFailedState ? "text-red-800" : "text-emerald-800"}`}>
              {showFailedState ? "Payment attempt summary" : "Transaction summary"}
            </p>
            <p className="text-sm text-gray-700">
              Session token: <span className="font-mono text-xs">{sessionToken || "N/A"}</span>
            </p>
            {sessionRecord?.booking_code && (
              <p className="text-sm text-gray-700">Booking code: <span className="font-semibold">{sessionRecord.booking_code}</span></p>
            )}
            {sessionRecord?.service_title && (
              <p className="text-sm text-gray-700">Package: <span className="font-semibold">{sessionRecord.service_title}</span></p>
            )}
            {sessionRecord?.guide_name && (
              <p className="text-sm text-gray-700">Guide: <span className="font-semibold">{sessionRecord.guide_name}</span></p>
            )}
            {amountText && (
              <p className="text-sm text-gray-700">
                {showFailedState ? "Amount attempted" : "Amount paid"}: <span className="font-semibold">{amountText}</span>
              </p>
            )}
            {paymentProviderLabel && <p className="text-sm text-gray-700">Payment method: <span className="font-semibold">{paymentProviderLabel}</span></p>}
            {sessionRecord?.transaction_uuid && (
              <p className="text-sm text-gray-700">Transaction: <span className="font-mono text-xs">{sessionRecord.transaction_uuid}</span></p>
            )}
            {invoiceRecord?.invoice_number && (
              <p className="text-sm text-gray-700">Invoice: <span className="font-semibold">{invoiceRecord.invoice_number}</span></p>
            )}
            {(paymentFailureReason || isFailedBySession) && (
              <p className="text-sm text-red-700">
                Reason: <span className="font-semibold">{paymentFailureReason || resolvedPaymentStatus || "payment_failed"}</span>
              </p>
            )}
          </div>

          {sessionLoading && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading payment details...
            </div>
          )}

          {sessionError && (
            <p className="mt-4 text-sm text-red-600">{sessionError}</p>
          )}

          {!showFailedState && invoiceLoading && (
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing your invoice...
            </div>
          )}

          {!showFailedState && invoiceError && (
            <p className="mt-4 text-sm text-red-600">{invoiceError}</p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            {!showFailedState && invoiceRecord?.invoice_number && (
              <Link
                to={`/invoice/${invoiceRecord.booking_type}/${invoiceRecord.booking_id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy/10"
              >
                <ReceiptText className="h-4 w-4" />
                Open Invoice Page
              </Link>
            )}

            {!showFailedState && (
              <Link
                to="/my-bookings"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
              >
                <CalendarCheck2 className="h-4 w-4" />
                View My Bookings
              </Link>
            )}

            {homestayId && bookingType !== "guide_package" && (
              <Link
                to={`/homestays/${homestayId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ReceiptText className="h-4 w-4" />
                {showFailedState ? "Try Payment Again" : "Back To Homestay"}
              </Link>
            )}

            {serviceId && bookingType === "guide_package" && (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ReceiptText className="h-4 w-4" />
                Explore More Packages
              </Link>
            )}

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PaymentSuccess;
