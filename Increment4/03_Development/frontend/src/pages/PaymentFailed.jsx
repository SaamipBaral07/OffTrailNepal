import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, Home, ReceiptText, RotateCcw } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { useAuth } from "../context/AuthContext";

const PaymentFailed = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const sessionToken = searchParams.get("session_token") || "";
  const homestayId = searchParams.get("homestay_id") || "";
  const bookingType = searchParams.get("booking_type") || "homestay";
  const serviceId = searchParams.get("service_id") || "";
  const reason = searchParams.get("reason") || "service_unavailable";

  const humanReason = useMemo(() => {
    const normalized = String(reason || "").trim().toLowerCase();
    if (!normalized) return "Payment could not be completed.";

    if (normalized.includes("service") || normalized.includes("unavailable")) {
      return "Payment provider service is currently unavailable.";
    }
    if (normalized.includes("cancel")) {
      return "Payment was cancelled before completion.";
    }
    if (normalized.includes("verify")) {
      return "Payment verification failed.";
    }

    return normalized.replaceAll("_", " ");
  }, [reason]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-red-200 bg-white p-6 sm:p-8 shadow-[0_12px_30px_rgba(12,35,64,0.08)]">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-red-100 p-3 text-red-700">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-red-700 font-semibold">Payment Failed</p>
              <h1 className="text-3xl sm:text-4xl font-heading text-charcoal mt-1">Your booking was not completed</h1>
              <p className="text-gray-600 mt-2">
                No booking was created. Please retry your payment.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 space-y-2">
            <p className="text-sm font-semibold text-red-800">Failure details</p>
            <p className="text-sm text-gray-700">Reason: <span className="font-semibold">{humanReason}</span></p>
            <p className="text-sm text-gray-700">Session token: <span className="font-mono text-xs">{sessionToken || "N/A"}</span></p>
            <p className="text-sm text-gray-700">Booking type: <span className="font-semibold">{bookingType === "guide_package" ? "Guide Package" : "Homestay"}</span></p>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            {homestayId && bookingType !== "guide_package" && (
              <Link
                to={`/homestays/${homestayId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Link>
            )}

            {serviceId && bookingType === "guide_package" && (
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gold to-[#D4A43A] px-4 py-2.5 text-sm font-bold text-navy"
              >
                <RotateCcw className="h-4 w-4" />
                Try Guide Booking Again
              </Link>
            )}

            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Home className="h-4 w-4" />
              Go Home
            </Link>

            <Link
              to="/my-bookings"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ReceiptText className="h-4 w-4" />
              My Bookings
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default PaymentFailed;
