

import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Compass } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Simple Header */}
      <div className="h-20 border-b border-navy/10 flex items-center px-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-navy hover:text-navy/70 transition-colors"
        >
          <Compass className="w-5 h-5" />
          <span className="font-semibold">OffTrail</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg text-center">
          {/* 404 Heading */}
          <div className="mb-8">
            <h1 className="text-7xl md:text-8xl font-bold text-navy/20 mb-4">
              404
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-navy mb-4">
              Page Not Found
            </h2>
          </div>

          {/* Description */}
          <p className="text-lg text-navy/70 mb-12 leading-relaxed">
            The page you're looking for doesn't exist. It might have been moved or the URL might be incorrect.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            {/* Back Button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-navy/10 text-navy hover:bg-navy/20 rounded-lg font-semibold transition-colors border border-navy/20"
            >
              <ArrowLeft className="w-5 h-5" />
              Go Back
            </button>

            {/* Home Button */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white hover:bg-navy/90 rounded-lg font-semibold transition-colors"
            >
              <Home className="w-5 h-5" />
              Back Home
            </button>
          </div>

          {/* Navigation Links */}
          <div className="border-t border-navy/10 pt-12">
            <p className="text-sm text-navy/60 mb-6 font-semibold">EXPLORE</p>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-3">
              <button
                onClick={() => navigate("/trails")}
                className="px-4 py-2 text-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors"
              >
                → Trails
              </button>
              <button
                onClick={() => navigate("/homestays")}
                className="px-4 py-2 text-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors"
              >
                → Homestays
              </button>
              <button
                onClick={() => navigate("/guides")}
                className="px-4 py-2 text-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors"
              >
                → Guides
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="px-4 py-2 text-sm font-medium text-navy/70 hover:text-navy hover:bg-navy/5 rounded-lg transition-colors"
              >
                → Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-navy/10 py-6 px-6 text-center text-sm text-navy/50">
        <p>Error 404 • Page Not Found</p>
      </div>
    </div>
  );
}
