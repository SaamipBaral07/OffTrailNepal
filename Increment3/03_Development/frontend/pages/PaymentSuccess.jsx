import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CalendarCheck2, Loader2, Home, ReceiptText } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const PaymentSuccess = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const sessionToken = searchParams.get("session_token") || "";
  const homestayId = searchParams.get("homestay_id") || "";

  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionRecord, setSessionRecord] = useState(null);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionToken || !user || user.user_type !== "tourist") return;

      setSessionLoading(true);
      setSessionError("");
      try {
        const res = await api.get(`/api/bookings/payment/session/${sessionToken}`);
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
  }, [loading, sessionToken, user]);

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
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-semibold">Payment Completed</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal mt-1">Your booking is confirmed</h1>
              <p className="text-gray-600 mt-2">
                Thank you. Your {paymentProviderLabel ? `${paymentProviderLabel} ` : ""}payment was successful and your homestay booking has been finalized.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
            <p className="text-sm text-emerald-800 font-semibold">Transaction summary</p>
            <p className="text-sm text-gray-700">
              Session token: <span className="font-mono text-xs">{sessionToken || "N/A"}</span>
            </p>
            {sessionRecord?.booking_code && (
              <p className="text-sm text-gray-700">Booking code: <span className="font-semibold">{sessionRecord.booking_code}</span></p>
            )}
            {amountText && <p className="text-sm text-gray-700">Amount paid: <span className="font-semibold">{amountText}</span></p>}
            {paymentProviderLabel && <p className="text-sm text-gray-700">Payment method: <span className="font-semibold">{paymentProviderLabel}</span></p>}
            {sessionRecord?.transaction_uuid && (
              <p className="text-sm text-gray-700">Transaction: <span className="font-mono text-xs">{sessionRecord.transaction_uuid}</span></p>
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

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/my-bookings"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
            >
              <CalendarCheck2 className="h-4 w-4" />
              View My Bookings
            </Link>

            {homestayId && (
              <Link
                to={`/homestays/${homestayId}`}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ReceiptText className="h-4 w-4" />
                Back To Homestay
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
