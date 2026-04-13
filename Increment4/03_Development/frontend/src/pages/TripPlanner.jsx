import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Route, Wallet, ListChecks, CalendarDays } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import LogoutModal from "../components/LogoutModal";
import { useLogoutHandler } from "../hooks/useLogoutHandler";
import { useAuth } from "../context/AuthContext";
import api from "../api";

const initialForm = {
  start_date: "",
  trip_days: "5",
  budget_npr: "50000",
  group_size: "2",
  fitness_level: "intermediate",
  preferred_region: "",
  preferred_difficulty: "",
  interests: "culture, mountains",
  needs_guide: true,
  needs_homestay: true,
  max_altitude: "",
  notes: "",
};

const toCsvList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatMoney = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "NPR 0";
  return `NPR ${parsed.toLocaleString("en-NP")}`;
};

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderPlan = (container) => {
  if (!container) return null;

  const plan = container.generated_plan || container.plan || null;
  if (!plan) return null;

  const cost = plan.cost_breakdown || {};
  const dayPlan = Array.isArray(plan.day_plan) ? plan.day_plan : [];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#0C2340]/10 bg-white p-5">
        <h3 className="text-lg font-bold text-[#0C2340]">{plan.title || "Generated Trip Plan"}</h3>
        <p className="mt-2 text-sm text-[#0C2340]/70">{plan.overview || "No summary available."}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#C8932A]/30 bg-[#FFF8E8] p-4">
          <p className="text-xs uppercase tracking-wide text-[#8A6A23]">Total Cost</p>
          <p className="mt-1 text-sm font-bold text-[#0C2340]">{formatMoney(cost.total_estimated_npr)}</p>
        </div>
        <div className="rounded-xl border border-[#0C2340]/15 bg-[#F5F8FC] p-4">
          <p className="text-xs uppercase tracking-wide text-[#3A4D63]">Homestay</p>
          <p className="mt-1 text-sm font-bold text-[#0C2340]">{formatMoney(cost.homestay_total_npr)}</p>
        </div>
        <div className="rounded-xl border border-[#0C2340]/15 bg-[#F5F8FC] p-4">
          <p className="text-xs uppercase tracking-wide text-[#3A4D63]">Guide</p>
          <p className="mt-1 text-sm font-bold text-[#0C2340]">{formatMoney(cost.guide_total_npr)}</p>
        </div>
        <div className="rounded-xl border border-[#0C2340]/15 bg-[#F5F8FC] p-4">
          <p className="text-xs uppercase tracking-wide text-[#3A4D63]">Budget Fit</p>
          <p className="mt-1 text-sm font-bold text-[#0C2340]">{String(cost.budget_fit || "unknown")}</p>
        </div>
      </div>

      {(cost.trip_days_used || cost.daily_homestay_rate_npr || cost.daily_guide_rate_npr) && (
        <div className="rounded-xl border border-[#0C2340]/10 bg-[#F9FBFE] p-4 text-xs text-[#0C2340]/75">
          <p className="font-semibold text-[#0C2340] mb-1">Cost Basis</p>
          <p>
            Days used: {cost.trip_days_used || "-"} | Daily homestay: {formatMoney(cost.daily_homestay_rate_npr)} | Daily guide: {formatMoney(cost.daily_guide_rate_npr)} | Daily misc: {formatMoney(cost.daily_misc_rate_npr)}
          </p>
          {cost.selected_homestay?.name && (
            <p className="mt-1">Homestay source: {cost.selected_homestay.name} ({cost.selected_homestay.location || "location not set"})</p>
          )}
          {cost.selected_guide_service?.title && (
            <p className="mt-1">Guide source: {cost.selected_guide_service.title} - {cost.selected_guide_service.guide_name || "guide"}</p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-[#0C2340]/10 bg-white p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-[#C8932A]" />
          <h4 className="text-sm font-bold text-[#0C2340]">Day by Day Plan</h4>
        </div>
        {dayPlan.length === 0 ? (
          <p className="text-sm text-[#0C2340]/60">No day plan found in this response.</p>
        ) : (
          <div className="space-y-3 max-h-[480px] overflow-auto pr-1">
            {dayPlan.map((day, index) => (
              <div key={`${day.day || index}-${index}`} className="rounded-xl border border-[#0C2340]/10 p-4">
                <p className="text-xs uppercase tracking-wide text-[#8A6A23]">Day {day.day || index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-[#0C2340]">{day.title || "Itinerary item"}</p>
                {Array.isArray(day.activities) && day.activities.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-[#0C2340]/75 space-y-1">
                    {day.activities.map((activity, idx) => (
                      <li key={`${idx}-${activity}`}>{activity}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-[#0C2340]/65">
                  Daily estimate: {formatMoney(day.estimated_cost_npr)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TripPlanner = () => {
  const { user, loading } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [historyPlans, setHistoryPlans] = useState([]);
  const [activePlanContainer, setActivePlanContainer] = useState(null);
  const [notice, setNotice] = useState(null);
  const [regionOptions, setRegionOptions] = useState([]);
  const [difficultyOptions, setDifficultyOptions] = useState([]);

  const {
    handleLogout,
    handleStayLoggedIn,
    showLogoutModal,
    setShowLogoutModal,
  } = useLogoutHandler();

  const pushNotice = useCallback((message, type = "success") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const loadPlanHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await api.get("/api/trip-planner/my");
      setHistoryPlans(Array.isArray(res.data?.plans) ? res.data.plans : []);
    } catch (error) {
      pushNotice(error.response?.data?.message || "Could not load trip plans", "error");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [pushNotice]);

  const loadPlannerFilters = useCallback(async () => {
    try {
      const res = await api.get("/api/trails/public");
      const filters = res.data?.filters || {};
      setRegionOptions(Array.isArray(filters.regions) ? filters.regions : []);
      setDifficultyOptions(Array.isArray(filters.difficulties) ? filters.difficulties : []);
    } catch {
      setRegionOptions([]);
      setDifficultyOptions([]);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (user?.user_type === "tourist") {
      loadPlanHistory();
      loadPlannerFilters();
    }
  }, [loading, user, loadPlanHistory, loadPlannerFilters]);

  const formPayload = useMemo(() => {
    const payload = {
      start_date: form.start_date || null,
      trip_days: form.trip_days ? Number(form.trip_days) : null,
      budget_npr: form.budget_npr ? Number(form.budget_npr) : null,
      group_size: form.group_size ? Number(form.group_size) : 1,
      fitness_level: form.fitness_level,
      preferred_regions: form.preferred_region ? [form.preferred_region] : [],
      preferred_difficulties: form.preferred_difficulty ? [form.preferred_difficulty] : [],
      interests: toCsvList(form.interests),
      needs_guide: Boolean(form.needs_guide),
      needs_homestay: Boolean(form.needs_homestay),
      max_altitude: form.max_altitude ? Number(form.max_altitude) : null,
      notes: String(form.notes || "").trim(),
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === null || payload[key] === "") delete payload[key];
    });

    return payload;
  }, [form]);

  const handleGenerate = async (event) => {
    event.preventDefault();
    setIsGenerating(true);

    try {
      const res = await api.post("/api/trip-planner/generate", formPayload);
      setActivePlanContainer({
        plan_id: res.data?.plan_id,
        provider: res.data?.provider,
        model: res.data?.model,
        status: res.data?.status,
        match_strategy: res.data?.match_strategy || "strict",
        relaxed_filters: Array.isArray(res.data?.relaxed_filters) ? res.data.relaxed_filters : [],
        created_at: res.data?.created_at,
        plan: res.data?.plan,
      });
      pushNotice("Trip plan generated successfully.");
      await loadPlanHistory();
    } catch (error) {
      pushNotice(error.response?.data?.message || "Failed to generate trip plan", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const openHistoryPlan = async (planId) => {
    setIsPlanLoading(true);
    try {
      const res = await api.get(`/api/trip-planner/${planId}`);
      setActivePlanContainer(res.data?.plan || null);
    } catch (error) {
      pushNotice(error.response?.data?.message || "Failed to load selected plan", "error");
    } finally {
      setIsPlanLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f4f2ee] via-[#faf8f4] to-[#f2efe8]">
      <Header user={user} onLogoutClick={() => setShowLogoutModal(true)} />

      {notice && (
        <div
          className={`fixed right-4 top-20 z-[100] rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${
            notice.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {notice.message}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-20">
        <section className="rounded-3xl border border-gold/20 bg-white/90 shadow-[0_10px_30px_rgba(12,35,64,0.08)] p-6 sm:p-8 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gold font-semibold">AI Itinerary Builder</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-[#0C2340]">Trip Planner</h1>
              <p className="mt-2 text-[#0C2340]/70 max-w-2xl">
                Generate personalized trekking plans using your preferred region, budget, and trip style.
                Plans are saved in your history so you can revisit them anytime.
              </p>
            </div>
            <div className="rounded-2xl border border-[#0C2340]/10 bg-[#F5F8FC] px-4 py-3 text-sm text-[#0C2340]/75">
              <p><span className="font-semibold">User:</span> {user?.full_name || "Tourist"}</p>
              <p><span className="font-semibold">Role:</span> {user?.user_type || "tourist"}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <article className="xl:col-span-2 rounded-3xl border border-[#0C2340]/12 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-gold" />
              <h2 className="text-lg font-bold text-[#0C2340]">Generate New Plan</h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-[#0C2340]/80">
                  Start Date
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </label>
                <label className="text-sm text-[#0C2340]/80">
                  Trip Days
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={form.trip_days}
                    onChange={(e) => setForm((prev) => ({ ...prev, trip_days: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-[#0C2340]/80">
                  Group Size
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={form.group_size}
                    onChange={(e) => setForm((prev) => ({ ...prev, group_size: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm text-[#0C2340]/80">
                  Budget (NPR)
                  <input
                    type="number"
                    min="1000"
                    value={form.budget_npr}
                    onChange={(e) => setForm((prev) => ({ ...prev, budget_npr: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-[#0C2340]/80">
                  Fitness Level
                  <select
                    value={form.fitness_level}
                    onChange={(e) => setForm((prev) => ({ ...prev, fitness_level: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </label>
                <label className="text-sm text-[#0C2340]/80 block">
                  Max Altitude (optional)
                  <input
                    type="number"
                    min="1000"
                    value={form.max_altitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, max_altitude: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                    placeholder="4500"
                  />
                </label>
              </div>

              <label className="text-sm text-[#0C2340]/80 block">
                Preferred Region
                <select
                  value={form.preferred_region}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferred_region: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                >
                  <option value="">Any Region</option>
                  {regionOptions.map((region) => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-[#0C2340]/80 block">
                Preferred Difficulty
                <select
                  value={form.preferred_difficulty}
                  onChange={(e) => setForm((prev) => ({ ...prev, preferred_difficulty: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                >
                  <option value="">Any Difficulty</option>
                  {difficultyOptions.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{difficulty}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-[#0C2340]/80 block">
                Interests (comma separated)
                <input
                  type="text"
                  value={form.interests}
                  onChange={(e) => setForm((prev) => ({ ...prev, interests: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  placeholder="culture, sunrise, mountain views"
                />
              </label>

              <label className="text-sm text-[#0C2340]/80 block">
                Notes
                <textarea
                  rows="3"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-[#0C2340]/15 px-3 py-2 text-sm"
                  placeholder="Any preferences or constraints"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 text-sm text-[#0C2340]/85">
                <label className="flex items-center gap-2 rounded-xl border border-[#0C2340]/12 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={form.needs_guide}
                    onChange={(e) => setForm((prev) => ({ ...prev, needs_guide: e.target.checked }))}
                  />
                  Need Guide
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-[#0C2340]/12 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={form.needs_homestay}
                    onChange={(e) => setForm((prev) => ({ ...prev, needs_homestay: e.target.checked }))}
                  />
                  Need Homestay
                </label>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0C2340] to-[#1E4C76] px-4 py-3 text-white font-semibold hover:opacity-95 disabled:opacity-60"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
                {isGenerating ? "Generating..." : "Generate Trip Plan"}
              </button>
            </form>
          </article>

          <article className="xl:col-span-3 rounded-3xl border border-[#0C2340]/12 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-gold" />
                <h2 className="text-lg font-bold text-[#0C2340]">Generated Plan</h2>
              </div>

              {activePlanContainer?.provider && (
                <div className="text-xs text-[#0C2340]/70 rounded-lg border border-[#0C2340]/12 px-3 py-1.5">
                  Provider: <span className="font-semibold">{activePlanContainer.provider}</span>
                  {activePlanContainer.model ? ` | Model: ${activePlanContainer.model}` : ""}
                </div>
              )}
            </div>

            {activePlanContainer?.match_strategy && activePlanContainer.match_strategy !== "strict" && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Filters were automatically broadened due limited listings.
                {Array.isArray(activePlanContainer.relaxed_filters) && activePlanContainer.relaxed_filters.length > 0
                  ? ` Relaxed: ${activePlanContainer.relaxed_filters.join(", ")}.`
                  : ""
                }
              </div>
            )}

            {isPlanLoading ? (
              <div className="min-h-[220px] flex items-center justify-center text-[#0C2340]/65">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading selected plan...
              </div>
            ) : activePlanContainer ? (
              renderPlan(activePlanContainer)
            ) : (
              <div className="min-h-[220px] rounded-2xl border border-dashed border-[#0C2340]/20 bg-[#F9FBFE] flex items-center justify-center text-center text-[#0C2340]/60 px-6">
                Generate a new plan or open one from history to view full itinerary.
              </div>
            )}
          </article>
        </section>

        <section className="mt-8 rounded-3xl border border-[#0C2340]/12 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-[#0C2340] flex items-center gap-2">
              <Wallet className="h-4 w-4 text-gold" />
              Saved Plan History
            </h2>
            <button
              type="button"
              onClick={loadPlanHistory}
              className="text-sm rounded-lg border border-[#0C2340]/15 px-3 py-1.5 hover:bg-[#F5F8FC]"
            >
              Refresh
            </button>
          </div>

          {isHistoryLoading ? (
            <div className="py-8 text-sm text-[#0C2340]/65 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading saved plans...
            </div>
          ) : historyPlans.length === 0 ? (
            <p className="text-sm text-[#0C2340]/65">No saved plans yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-[#0C2340]/70 border-b border-[#0C2340]/12">
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Estimated Cost</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPlans.map((plan) => (
                    <tr key={plan.plan_id} className="border-b border-[#0C2340]/10">
                      <td className="py-3 pr-4 text-[#0C2340] font-medium">{plan.plan_title || `Plan #${plan.plan_id}`}</td>
                      <td className="py-3 pr-4">{plan.provider || "-"}</td>
                      <td className="py-3 pr-4 capitalize">{plan.status || "-"}</td>
                      <td className="py-3 pr-4">{formatMoney(plan.total_estimated_cost)}</td>
                      <td className="py-3 pr-4">{formatDateTime(plan.created_at)}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => openHistoryPlan(plan.plan_id)}
                          className="rounded-lg bg-[#0C2340] px-3 py-1.5 text-white hover:opacity-90"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

export default TripPlanner;
