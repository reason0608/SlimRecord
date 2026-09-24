"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
  Scale,
  Sparkles,
  Trophy,
  TrendingDown,
  Utensils,
} from "lucide-react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import fitnessData from "@/data/fitness-data.json";
import {
  aggregateFoodByDate,
  completionPercent,
  firstMetric,
  goalForDate,
  latestMetric,
  signedChange,
} from "@/lib/metrics";
import { fetchSheetData } from "@/lib/sheets-data";
import { bodyComposition, bodyScoreTrend, competitionLeaderboard, inclusiveRangeStart, latestMassReading, mergeCompetitionRecords, summarizeFoodRange } from "@/lib/dashboard-data";

type UserName = "Reason" | "Chloe";
type DashboardView = UserName | "All";
type DailyLog = {
  date: string;
  user: UserName;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_pct: number | null;
  exercised: boolean | null;
  note: string | null;
};
type FoodLog = {
  id: string;
  date: string;
  user: UserName;
  meal_type: string | null;
  food_name: string | null;
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  note: string | null;
};
type ExerciseLog = {
  date: string;
  user: UserName;
  exercise_type: string | null;
  duration_minutes: number | null;
  intensity: string | null;
  steps: number | null;
  note: string | null;
};
type Goal = {
  user: UserName;
  day_type: "rest" | "exercise";
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  effective_from: string;
};
type InBodyLog = {
  date: string;
  user: string;
  body_fat_mass_kg: number | null;
  muscle_mass_kg: number | null;
  score: number | null;
  rank: number | null;
  note: string | null;
};

type DashboardData = {
  dailyLogs: DailyLog[];
  foodLogs: FoodLog[];
  exerciseLogs: ExerciseLog[];
  goals: Goal[];
  inBodyLogs?: InBodyLog[];
};

const demoData = fitnessData as DashboardData;
const spreadsheetId = "1CNn3qJeZ90h61oi9OlPiZxGvGPcl3pND_CKGjX7kHHE";
const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GoogleOAuth = {
  accounts: { oauth2: { initTokenClient: (options: {
    client_id: string;
    scope: string;
    callback: (response: { access_token?: string; error?: string }) => void;
    error_callback: () => void;
  }) => { requestAccessToken: () => void } } };
};

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );

const numberLabel = (value: number | null, digits = 1) =>
  value == null ? "—" : value.toFixed(digits);

function MetricCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: typeof Scale;
}) {
  return (
    <Card className="metric-card border-0 shadow-none">
      <CardContent className="p-5">
        <div className="mb-6 flex items-start justify-between">
          <span className="text-sm font-medium text-emerald-950/65">{label}</span>
          <span className="rounded-full bg-white/70 p-2 text-emerald-950"><Icon size={18} /></span>
        </div>
        <p className="font-display text-3xl font-semibold tracking-tight text-emerald-950">
          {value}<span className="ml-1 text-sm font-medium text-emerald-950/55">{unit}</span>
        </p>
        <p className="mt-2 text-xs text-emerald-950/55">{detail}</p>
      </CardContent>
    </Card>
  );
}

type NutritionTotals = { calories: number; protein_g: number; fat_g: number; carbs_g: number };

function NutritionSummary({ totals }: { totals: NutritionTotals }) {
  const items = [
    { label: "熱量", value: Math.round(totals.calories), unit: "kcal" },
    { label: "蛋白質", value: numberLabel(totals.protein_g), unit: "g" },
    { label: "脂肪", value: numberLabel(totals.fat_g), unit: "g" },
    { label: "碳水", value: numberLabel(totals.carbs_g), unit: "g" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className="mt-1 font-semibold tabular-nums text-slate-800">{item.value} <span className="text-xs font-normal text-slate-500">{item.unit}</span></p>
        </div>
      ))}
    </div>
  );
}

function NutrientProgress({ label, actual, target, unit }: { label: string; actual: number; target: number; unit: string }) {
  const percent = completionPercent(actual, target);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {Math.round(actual)} / {target} {unit}
        </span>
      </div>
      <Progress value={percent} className="h-2 bg-emerald-950/8 [&>div]:bg-emerald-800" />
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<DashboardView>("Reason");
  const [liveData, setLiveData] = useState<DashboardData | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const data = liveData ?? demoData;
  const user: UserName = view === "All" ? "Reason" : view;

  useEffect(() => {
    if (!googleClientId) return;
    const googleWindow = window as Window & { google?: GoogleOAuth };
    if (googleWindow.google?.accounts?.oauth2) {
      queueMicrotask(() => setGoogleReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setSheetError("無法載入 Google 登入功能，請檢查網路連線。");
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  /** Start OAuth from the button gesture; keep access tokens only inside this callback. */
  const connectSheet = () => {
    const google = (window as Window & { google?: GoogleOAuth }).google;
    if (!google?.accounts?.oauth2 || !googleClientId) return;
    setLoadingSheet(true);
    setSheetError("");
    google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      callback: async (response) => {
        if (!response.access_token) {
          setSheetError("Google 授權未完成，請重試。");
          setLoadingSheet(false);
          return;
        }
        try {
          const sheetData = await fetchSheetData(response.access_token, spreadsheetId) as DashboardData;
          setLiveData(sheetData);
          setSelectedDateByUser({ Reason: "", Chloe: "" });
        } catch (error) {
          setSheetError(error instanceof Error ? error.message : "讀取試算表失敗。");
        } finally {
          setLoadingSheet(false);
        }
      },
      error_callback: () => {
        setSheetError("Google 登入視窗已關閉或無法開啟，請重試。");
        setLoadingSheet(false);
      },
    }).requestAccessToken();
  };

  const userDaily = useMemo(
    () => data.dailyLogs.filter((entry) => entry.user === user).sort((a, b) => a.date.localeCompare(b.date)),
    [data, user],
  );
  const userFood = useMemo(() => data.foodLogs.filter((entry) => entry.user === user), [data, user]);
  const userExercise = useMemo(() => data.exerciseLogs.filter((entry) => entry.user === user), [data, user]);
  const nutritionByDate = useMemo(() => aggregateFoodByDate(userFood), [userFood]);
  const availableDates = useMemo(
    () => [...new Set([...userDaily.map((entry) => entry.date), ...userFood.map((entry) => entry.date)])].sort(),
    [userDaily, userFood],
  );
  const [selectedDateByUser, setSelectedDateByUser] = useState<Record<UserName, string>>({ Reason: "", Chloe: "" });
  const selectedDate = selectedDateByUser[user] || availableDates.at(-1) || "";
  const selectedDaily = userDaily.find((entry) => entry.date === selectedDate);
  const selectedNutrition = nutritionByDate[selectedDate] ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  const dayType = selectedDaily?.exercised ? "exercise" : "rest";
  const selectedGoal = goalForDate(data.goals, user, dayType, selectedDate);
  const currentWeight = latestMetric(userDaily, "weight_kg") as number | null;
  const startingWeight = firstMetric(userDaily, "weight_kg") as number | null;
  // A percentage and weight must come from the same measurement to produce a meaningful mass.
  const latestFat = latestMassReading(userDaily, "body_fat_pct", "fatMassKg");
  const latestMuscle = latestMassReading(userDaily, "muscle_pct", "muscleMassKg");
  const scoreTrend = bodyScoreTrend(userDaily);
  const latestScore = scoreTrend.at(-1) ?? null;
  const trendData = userDaily.map((entry) => {
    const goal = goalForDate(data.goals, user, entry.exercised ? "exercise" : "rest", entry.date);
    return {
      ...entry,
      label: dateLabel(entry.date),
      ...bodyComposition(entry),
      calories: nutritionByDate[entry.date]?.calories ?? null,
      protein: nutritionByDate[entry.date]?.protein_g ?? null,
      calorieTarget: goal?.calories ?? null,
      proteinTarget: goal?.protein ?? null,
    };
  });
  const scoreChartData = scoreTrend.map((point: { date: string; score: number }) => ({ ...point, label: dateLabel(point.date) }));
  const [foodDateRange, setFoodDateRange] = useState<Record<UserName, { start: string; end: string }>>({
    Reason: { start: "", end: "" },
    Chloe: { start: "", end: "" },
  });
  const range = foodDateRange[user];
  const latestFoodDate = [...new Set(userFood.map((entry) => entry.date))].sort().at(-1) ?? "";
  const foodSummary = useMemo(
    () => summarizeFoodRange(userFood, range.start, range.end),
    [userFood, range.start, range.end],
  );
  const invalidFoodRange = Boolean(range.start && range.end && range.start > range.end);
  const updateFoodRange = (next: { start: string; end: string }) =>
    setFoodDateRange((previous) => ({ ...previous, [user]: next }));
  const setFoodPreset = (days: number | null) =>
    updateFoodRange(days == null ? { start: "", end: "" } : {
      start: inclusiveRangeStart(latestFoodDate, days),
      end: latestFoodDate,
    });
  const trackedDays = new Set(userFood.map((entry) => entry.date)).size;
  const proteinTargetDays = availableDates.filter((date) => {
    const daily = userDaily.find((entry) => entry.date === date);
    const goal = goalForDate(data.goals, user, daily?.exercised ? "exercise" : "rest", date);
    return goal && (nutritionByDate[date]?.protein_g ?? 0) >= goal.protein;
  }).length;
  const competitionRecords = useMemo(() => {
    return mergeCompetitionRecords(data.dailyLogs, data.inBodyLogs);
  }, [data]);
  const leaderboard = useMemo(() => competitionLeaderboard(competitionRecords), [competitionRecords]);
  const personalStanding = leaderboard.find((entry) => entry.user === user) ?? null;
  const currentRank = personalStanding?.rank ?? null;

  const changeDate = (date: string) => setSelectedDateByUser((previous) => ({ ...previous, [user]: date }));

  return (
    <main className="min-h-screen bg-[#f4f1e9] text-slate-900">
      <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-7 lg:px-10 lg:py-8">
        <header className="mb-7 flex flex-col gap-5 rounded-[28px] bg-[#173f35] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d7f49b] text-[#173f35]"><TrendingDown size={25} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7f49b]">Slim record</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">減脂紀錄</h1>
            </div>
          </div>
          <div className="flex rounded-2xl bg-white/10 p-1" aria-label="選擇使用者">
            {(["Reason", "Chloe", "All"] as DashboardView[]).map((name) => (
              <button
                key={name}
                onClick={() => setView(name)}
                className={`min-w-24 rounded-xl px-4 py-2 text-sm font-semibold transition ${view === name ? "bg-white text-[#173f35] shadow-sm" : "text-white/70 hover:text-white"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </header>

        <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${liveData ? "border-emerald-300 bg-emerald-50 text-emerald-950" : "border-amber-300 bg-amber-50 text-amber-950"}`}>
          <div>
            <p>{liveData ? "已載入 Google 試算表資料（僅在這個瀏覽器頁面顯示）。" : "目前顯示示範資料，不含真實健康紀錄。"}</p>
            {sheetError && <p role="alert" className="mt-1 text-red-700">{sheetError}</p>}
            {!googleClientId && <p className="mt-1">尚未設定 Google OAuth Client ID，請參閱 README。</p>}
          </div>
          {googleClientId && (
            <button type="button" onClick={connectSheet} disabled={!googleReady || loadingSheet}
              className="rounded-xl bg-[#173f35] px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              {loadingSheet ? "讀取中…" : liveData ? "重新載入試算表" : googleReady ? "連線 Google 試算表" : "載入 Google 登入中…"}
            </button>
          )}
        </div>
        {view === "All" ? (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="參賽人數" value={String(leaderboard.length)} unit="人" detail="已填入至少一筆完整 InBody" icon={Trophy} />
              <MetricCard label="目前領先" value={leaderboard[0]?.user ?? "—"} unit="" detail={leaderboard[0] ? `${numberLabel(leaderboard[0].score, 2)} 分` : "尚無完整量測"} icon={Sparkles} />
              <MetricCard label="最新量測" value={leaderboard.map((entry) => entry.latestDate).sort().at(-1) ?? "—"} unit="" detail="所有參賽者最近一次量測日期" icon={CalendarDays} />
            </div>
            <Card className="border-0 bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-xl">所有參賽者排行榜</CardTitle>
                <p className="text-sm text-slate-500">以每位參賽者第一筆完整 InBody 為基準，依最新一筆量測計算；同分並列。</p>
              </CardHeader>
              <CardContent>
                {leaderboard.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="px-3 py-3 text-center">排名</th><th className="px-3 py-3">參賽者</th><th className="px-3 py-3 text-right">分數</th>
                        <th className="px-3 py-3 text-right">體脂變化</th><th className="px-3 py-3 text-right">肌肉變化</th>
                        <th className="px-3 py-3 text-right">目前體脂重</th><th className="px-3 py-3 text-right">目前肌肉重</th><th className="px-3 py-3 text-right">量測日</th>
                      </tr></thead>
                      <tbody>{leaderboard.map((entry) => (
                        <tr key={entry.user} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-4 text-center"><span className={`inline-grid h-9 w-9 place-items-center rounded-full font-bold ${entry.rank <= 3 ? "bg-[#d7f49b] text-[#173f35]" : "bg-slate-100 text-slate-600"}`}>{entry.rank}</span></td>
                          <td className="px-3 py-4 font-semibold text-slate-900">{entry.user}</td>
                          <td className="px-3 py-4 text-right text-lg font-bold tabular-nums text-violet-700">{numberLabel(entry.score, 2)}</td>
                          <td className="px-3 py-4 text-right tabular-nums">{numberLabel(entry.fatChangePercent, 2)}%</td>
                          <td className="px-3 py-4 text-right tabular-nums">{numberLabel(entry.muscleChangePercent, 2)}%</td>
                          <td className="px-3 py-4 text-right tabular-nums">{numberLabel(entry.fatMassKg, 2)} kg</td>
                          <td className="px-3 py-4 text-right tabular-nums">{numberLabel(entry.muscleMassKg, 2)} kg</td>
                          <td className="px-3 py-4 text-right text-slate-500">{entry.latestDate}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <div className="grid min-h-52 place-items-center text-center text-slate-500">請先在 InBodyLogs 工作表填入參賽者量測資料。</div>}
              </CardContent>
            </Card>
          </section>
        ) : (<>
        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="目前體重" value={numberLabel(currentWeight)} unit="kg" detail={`起始至今 ${signedChange(currentWeight, startingWeight)} kg`} icon={Scale} />
          <MetricCard label="目前體脂重量" value={numberLabel(latestFat?.massKg ?? null)} unit="kg" detail={latestFat ? `體脂率 ${numberLabel(latestFat.percentage)}% · ${latestFat.date}` : "需同日體重與體脂率"} icon={Activity} />
          <MetricCard label="估計肌肉重量" value={numberLabel(latestMuscle?.massKg ?? null)} unit="kg" detail={latestMuscle ? `肌肉率 ${numberLabel(latestMuscle.percentage)}% · ${latestMuscle.date}` : "需同日體重與肌肉率"} icon={Dumbbell} />
          <MetricCard label="蛋白質達標" value={`${proteinTargetDays}`} unit={`/ ${trackedDays} 天`} detail="依運動日／休息日目標判斷" icon={Sparkles} />
          <MetricCard label="目前分數" value={numberLabel(personalStanding?.score ?? latestScore?.score ?? null, 2)} unit="分" detail={currentRank ? `目前第 ${currentRank} 名 · 體脂減少% + 3 × 正肌肉增幅` : "尚無完整 InBody 排名資料"} icon={Trophy} />
        </section>

        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 sm:w-fit">
            <TabsTrigger value="overview" className="rounded-xl px-5 py-2.5">成果總覽</TabsTrigger>
            <TabsTrigger value="food" className="rounded-xl px-5 py-2.5">每日飲食</TabsTrigger>
            <TabsTrigger value="exercise" className="rounded-xl px-5 py-2.5">運動紀錄</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
              <Card className="border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-xl">體重與身體組成趨勢</CardTitle>
                  <p className="text-xs text-slate-500">體脂重量、除脂體重與估計肌肉重量僅依同日量測換算；上圖左右軸分別為體重與除脂體重。</p>
                </CardHeader>
                <CardContent className="space-y-3 px-2 pb-5 pr-4">
                  {/* Identical margins and 44px axes keep each date at the same horizontal position. */}
                  <div>
                    <p className="px-4 text-xs font-semibold"><span className="text-[#173f35]">● 體重</span><span className="ml-4 text-[#3b82a0]">● 除脂體重</span><span className="ml-2 text-slate-400">· kg</span></p>
                    <div className="h-[150px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={140}>
                        <LineChart syncId="body-composition" data={trendData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="date" hide />
                          <YAxis yAxisId="weight" width={44} domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#173f35" }} tickFormatter={(value: number) => value.toFixed(1)} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="lean" orientation="right" width={44} domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#3b82a0" }} tickFormatter={(value: number) => value.toFixed(1)} axisLine={false} tickLine={false} />
                          <ChartTooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} formatter={(value) => typeof value === "number" ? value.toFixed(1) : value} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                          <Line yAxisId="weight" type="monotone" dataKey="weight_kg" name="體重 kg" stroke="#173f35" strokeWidth={3} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                          <Line yAxisId="lean" type="monotone" dataKey="fatFreeMassKg" name="除脂體重 kg" stroke="#3b82a0" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <p className="px-4 text-xs font-semibold text-[#e66f45]">● 體脂重量 · kg</p>
                    <div className="h-[145px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={135}>
                        <LineChart syncId="body-composition" data={trendData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="date" hide />
                          <YAxis width={44} domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#e66f45" }} tickFormatter={(value: number) => value.toFixed(1)} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="spacer" orientation="right" width={44} tick={false} axisLine={false} tickLine={false} />
                          <ChartTooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} formatter={(value) => typeof value === "number" ? value.toFixed(1) : value} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                          <Line type="monotone" dataKey="fatMassKg" name="體脂重量 kg" stroke="#e66f45" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div>
                    <p className="px-4 text-xs font-semibold text-[#3b82a0]">● 估計肌肉重量 · kg</p>
                    <div className="h-[165px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={155}>
                        <LineChart syncId="body-composition" data={trendData} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="date" tickFormatter={(value: string) => dateLabel(value)} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                          <YAxis width={44} domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#3b82a0" }} tickFormatter={(value: number) => value.toFixed(1)} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="spacer" orientation="right" width={44} tick={false} axisLine={false} tickLine={false} />
                          <ChartTooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} formatter={(value) => typeof value === "number" ? value.toFixed(1) : value} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                          <Line type="monotone" dataKey="muscleMassKg" name="估計肌肉重量 kg" stroke="#3b82a0" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-[#fffaf0] shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="font-display text-xl">當日營養</CardTitle>
                    <label className="relative flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                      <CalendarDays size={16} />
                      <input type="date" value={selectedDate} min={availableDates[0]} max={availableDates.at(-1)} onChange={(event) => changeDate(event.target.value)} className="bg-transparent font-medium outline-none" />
                    </label>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between rounded-2xl bg-[#173f35] p-4 text-white">
                    <div><p className="text-xs text-white/60">{dayType === "exercise" ? "運動日" : "休息日"}</p><p className="mt-1 font-display text-2xl font-semibold">{Math.round(selectedNutrition.calories)} kcal</p></div>
                    <Flame className="text-[#d7f49b]" size={28} />
                  </div>
                  {selectedGoal ? (
                    <div className="space-y-4">
                      <NutrientProgress label="熱量" actual={selectedNutrition.calories} target={selectedGoal.calories} unit="kcal" />
                      <NutrientProgress label="蛋白質" actual={selectedNutrition.protein_g} target={selectedGoal.protein} unit="g" />
                      <NutrientProgress label="脂肪" actual={selectedNutrition.fat_g} target={selectedGoal.fat} unit="g" />
                      <NutrientProgress label="碳水" actual={selectedNutrition.carbs_g} target={selectedGoal.carbs} unit="g" />
                    </div>
                  ) : <p className="text-sm text-slate-500">此日期沒有適用的目標設定。</p>}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-xl">每日熱量與蛋白質</CardTitle>
                  <p className="text-xs text-slate-500">實線為實際攝取，虛線為當日運動／休息目標。</p>
                </CardHeader>
                <CardContent className="h-[300px] pl-1 pr-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                    <ComposedChart data={trendData} margin={{ top: 15, right: 4, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f48c64" stopOpacity={0.45} /><stop offset="100%" stopColor="#f48c64" stopOpacity={0.03} /></linearGradient></defs>
                      <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="calories" width={44} tick={{ fontSize: 11, fill: "#e66f45" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="protein" orientation="right" width={36} tick={{ fontSize: 11, fill: "#3b82a0" }} axisLine={false} tickLine={false} />
                      <ChartTooltip formatter={(value) => typeof value === "number" ? value.toFixed(1) : value} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                      <Area yAxisId="calories" type="monotone" dataKey="calories" name="熱量 kcal" stroke="#e66f45" strokeWidth={2.5} fill="url(#calorieFill)" connectNulls isAnimationActive={false} />
                      <Line yAxisId="calories" type="stepAfter" dataKey="calorieTarget" name="熱量目標 kcal" stroke="#e66f45" strokeWidth={1.5} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />
                      <Line yAxisId="protein" type="monotone" dataKey="protein" name="蛋白質 g" stroke="#3b82a0" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                      <Line yAxisId="protein" type="stepAfter" dataKey="proteinTarget" name="蛋白質目標 g" stroke="#3b82a0" strokeWidth={1.5} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 bg-white shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="font-display text-xl">分數走勢</CardTitle>
                  <p className="text-xs text-slate-500">體脂減少% + 3 × MAX(肌肉增加%, 0)，以第一筆完整量測為基準。</p>
                </CardHeader>
                <CardContent className="h-[300px] pl-1 pr-4">
                  {scoreChartData.length ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={280}>
                      <LineChart data={scoreChartData} margin={{ top: 15, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                        <YAxis width={44} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(value: number) => value.toFixed(1)} axisLine={false} tickLine={false} />
                        <ChartTooltip formatter={(value) => typeof value === "number" ? value.toFixed(2) : value} contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                        <Line type="monotone" dataKey="score" name="分數" stroke="#7c3aed" strokeWidth={3} dot={{ r: 4, fill: "#d8b4fe" }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <div className="grid h-full place-items-center text-sm text-slate-500">需至少一筆同時含體重、體脂率及肌肉率的量測。</div>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="food">
            <Card className="border-0 bg-white shadow-sm">
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle className="font-display text-xl">每日飲食明細</CardTitle>
                  <p className="mt-1 text-sm text-slate-500">依日期分組 · {foodSummary.groups.length} 天、{foodSummary.count} 筆紀錄</p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="space-y-1 text-xs text-slate-600">開始日期
                    <input aria-label="飲食開始日期" type="date" value={range.start} onChange={(event) => updateFoodRange({ ...range, start: event.target.value })}
                      className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-700" />
                  </label>
                  <label className="space-y-1 text-xs text-slate-600">結束日期
                    <input aria-label="飲食結束日期" type="date" value={range.end} onChange={(event) => updateFoodRange({ ...range, end: event.target.value })}
                      className="block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-700" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFoodPreset(7)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">近 7 天</button>
                    <button type="button" onClick={() => setFoodPreset(30)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">近 30 天</button>
                    <button type="button" onClick={() => setFoodPreset(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50">全部</button>
                  </div>
                </div>
                {invalidFoodRange && <p role="alert" className="text-sm text-red-700">開始日期不能晚於結束日期。</p>}
              </CardHeader>
              <CardContent className="space-y-5">
                <section className="space-y-3 rounded-2xl bg-[#e8f3e9] p-4" aria-label="區間總量">
                  <p className="text-sm font-semibold text-emerald-950">區間總量</p>
                  <NutritionSummary totals={foodSummary.totals} />
                </section>
                {foodSummary.groups.length ? (
                  <div className="space-y-5">
                    {foodSummary.groups.map((group) => (
                      <section key={group.date} className="space-y-3 rounded-2xl border border-slate-200 p-4" aria-label={`${group.date} 飲食紀錄`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-display text-lg font-semibold">{group.date}</h3>
                          <p className="text-xs text-slate-500">{group.items.length} 筆 · 當日合計</p>
                        </div>
                        <NutritionSummary totals={group.totals} />
                        <div className="space-y-2">
                          {group.items.map((item: FoodLog) => (
                            <article key={item.id} className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                              <div className="flex items-start gap-3">
                                <span className="rounded-xl bg-[#d7f49b]/70 p-2 text-[#173f35]"><Utensils size={18} /></span>
                                <div><p className="font-semibold">{item.food_name ?? item.meal_type ?? "未命名紀錄"}</p><p className="mt-1 text-xs text-slate-500">{item.meal_type && item.food_name ? item.meal_type : item.note ?? "未填寫餐別"}</p></div>
                              </div>
                              <div className="grid grid-cols-4 gap-3 text-right text-xs text-slate-500 sm:min-w-[340px]">
                                <span><b className="block text-base text-slate-800">{Math.round(item.calories ?? 0)}</b>kcal</span>
                                <span><b className="block text-base text-slate-800">{numberLabel(item.protein_g)}</b>蛋白質</span>
                                <span><b className="block text-base text-slate-800">{numberLabel(item.fat_g)}</b>脂肪</span>
                                <span><b className="block text-base text-slate-800">{numberLabel(item.carbs_g)}</b>碳水</span>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : <div className="grid min-h-52 place-items-center text-center text-slate-500"><div><Utensils className="mx-auto mb-3 opacity-35" /><p>{invalidFoodRange ? "請調整日期區間" : "此區間沒有飲食紀錄"}</p></div></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exercise">
            <Card className="border-0 bg-white shadow-sm">
              <CardHeader><CardTitle className="font-display text-xl">運動紀錄</CardTitle></CardHeader>
              <CardContent>
                {userExercise.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {userExercise.map((item) => (
                      <article key={`${item.date}-${item.user}`} className="rounded-2xl bg-[#173f35] p-5 text-white">
                        <div className="mb-7 flex items-center justify-between"><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{dateLabel(item.date)}</span><Dumbbell className="text-[#d7f49b]" /></div>
                        <h3 className="font-display text-xl font-semibold">{item.exercise_type ?? "運動內容待補"}</h3>
                        <p className="mt-2 text-sm text-white/60">{item.duration_minutes ? `${item.duration_minutes} 分鐘` : "尚未記錄運動時長"}</p>
                      </article>
                    ))}
                  </div>
                ) : <div className="grid min-h-52 place-items-center text-center text-slate-500"><div><Dumbbell className="mx-auto mb-3 opacity-35" /><p>目前沒有運動紀錄</p></div></div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </>)}

        <footer className="mt-8 flex flex-col gap-2 border-t border-emerald-950/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{liveData ? "即時讀取試算表；重新載入頁面後須再次授權。空白量測不視為 0。" : "目前為示範資料；空白量測不視為 0。"}</p>
          <p>最近資料日期：{view === "All" ? leaderboard.map((entry) => entry.latestDate).sort().at(-1) ?? "—" : availableDates.at(-1) ?? "—"}</p>
        </footer>
      </div>
    </main>
  );
}
