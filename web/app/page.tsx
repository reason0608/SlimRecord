"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Dumbbell,
  Flame,
  Scale,
  Sparkles,
  TrendingDown,
  Utensils,
} from "lucide-react";
import {
  Area,
  AreaChart,
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

type UserName = "Reason" | "Chloe";
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

const data = fitnessData as {
  dailyLogs: DailyLog[];
  foodLogs: FoodLog[];
  exerciseLogs: ExerciseLog[];
  goals: Goal[];
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
  const [user, setUser] = useState<UserName>("Reason");
  const userDaily = useMemo(
    () => data.dailyLogs.filter((entry) => entry.user === user).sort((a, b) => a.date.localeCompare(b.date)),
    [user],
  );
  const userFood = useMemo(() => data.foodLogs.filter((entry) => entry.user === user), [user]);
  const userExercise = useMemo(() => data.exerciseLogs.filter((entry) => entry.user === user), [user]);
  const nutritionByDate = useMemo(() => aggregateFoodByDate(userFood), [userFood]);
  const availableDates = useMemo(
    () => [...new Set([...userDaily.map((entry) => entry.date), ...userFood.map((entry) => entry.date)])].sort(),
    [userDaily, userFood],
  );
  const [selectedDateByUser, setSelectedDateByUser] = useState<Record<UserName, string>>({ Reason: "", Chloe: "" });
  const selectedDate = selectedDateByUser[user] || availableDates.at(-1) || "";
  const selectedDaily = userDaily.find((entry) => entry.date === selectedDate);
  const selectedFood = userFood.filter((entry) => entry.date === selectedDate);
  const selectedNutrition = nutritionByDate[selectedDate] ?? { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
  const dayType = selectedDaily?.exercised ? "exercise" : "rest";
  const selectedGoal = goalForDate(data.goals, user, dayType, selectedDate);
  const currentWeight = latestMetric(userDaily, "weight_kg") as number | null;
  const startingWeight = firstMetric(userDaily, "weight_kg") as number | null;
  const currentBodyFat = latestMetric(userDaily, "body_fat_pct") as number | null;
  const currentMuscle = latestMetric(userDaily, "muscle_pct") as number | null;
  const trendData = userDaily.map((entry) => ({
    ...entry,
    label: dateLabel(entry.date),
    calories: nutritionByDate[entry.date]?.calories ?? null,
    protein: nutritionByDate[entry.date]?.protein_g ?? null,
  }));
  const trackedDays = new Set(userFood.map((entry) => entry.date)).size;
  const proteinTargetDays = availableDates.filter((date) => {
    const daily = userDaily.find((entry) => entry.date === date);
    const goal = goalForDate(data.goals, user, daily?.exercised ? "exercise" : "rest", date);
    return goal && (nutritionByDate[date]?.protein_g ?? 0) >= goal.protein;
  }).length;

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
            {(["Reason", "Chloe"] as UserName[]).map((name) => (
              <button
                key={name}
                onClick={() => setUser(name)}
                className={`min-w-24 rounded-xl px-4 py-2 text-sm font-semibold transition ${user === name ? "bg-white text-[#173f35] shadow-sm" : "text-white/70 hover:text-white"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </header>

        <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">目前顯示的是示範資料，不含真實健康紀錄。</p>
        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="目前體重" value={numberLabel(currentWeight)} unit="kg" detail={`起始至今 ${signedChange(currentWeight, startingWeight)} kg`} icon={Scale} />
          <MetricCard label="目前體脂" value={numberLabel(currentBodyFat)} unit="%" detail="以最近一次有效量測為準" icon={Activity} />
          <MetricCard label="目前肌肉率" value={numberLabel(currentMuscle)} unit="%" detail="空白量測不列入計算" icon={Dumbbell} />
          <MetricCard label="蛋白質達標" value={`${proteinTargetDays}`} unit={`/ ${trackedDays} 天`} detail="依運動日／休息日目標判斷" icon={Sparkles} />
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
                <CardHeader className="pb-2"><CardTitle className="font-display text-xl">體重與體脂趨勢</CardTitle></CardHeader>
                <CardContent className="h-[330px] pl-1 pr-4">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                    <LineChart data={trendData} margin={{ top: 16, right: 8, left: -14, bottom: 0 }}>
                      <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="weight" domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="fat" orientation="right" domain={["dataMin - 2", "dataMax + 2"]} hide />
                      <ChartTooltip contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                      <Line yAxisId="weight" type="monotone" dataKey="weight_kg" name="體重 kg" stroke="#173f35" strokeWidth={3} dot={{ r: 3, fill: "#d7f49b", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                      <Line yAxisId="fat" type="monotone" dataKey="body_fat_pct" name="體脂 %" stroke="#f48c64" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
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

            <Card className="border-0 bg-white shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="font-display text-xl">每日熱量攝取</CardTitle></CardHeader>
              <CardContent className="h-[280px] pl-1 pr-4">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <AreaChart data={trendData} margin={{ top: 15, right: 8, left: -14, bottom: 0 }}>
                    <defs><linearGradient id="calorieFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f48c64" stopOpacity={0.55} /><stop offset="100%" stopColor="#f48c64" stopOpacity={0.03} /></linearGradient></defs>
                    <CartesianGrid stroke="#e9e5dc" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <ChartTooltip contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0" }} />
                    <Area type="monotone" dataKey="calories" name="熱量 kcal" stroke="#e66f45" strokeWidth={2.5} fill="url(#calorieFill)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="food">
            <Card className="border-0 bg-white shadow-sm">
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div><CardTitle className="font-display text-xl">每日飲食明細</CardTitle><p className="mt-1 text-sm text-slate-500">共 {selectedFood.length} 筆紀錄</p></div>
                <input aria-label="選擇飲食日期" type="date" value={selectedDate} min={availableDates[0]} max={availableDates.at(-1)} onChange={(event) => changeDate(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none focus:border-emerald-700" />
              </CardHeader>
              <CardContent>
                {selectedFood.length ? (
                  <div className="space-y-3">
                    {selectedFood.map((item) => (
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
                ) : <div className="grid min-h-52 place-items-center text-center text-slate-500"><div><Utensils className="mx-auto mb-3 opacity-35" /><p>這一天尚無飲食紀錄</p></div></div>}
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

        <footer className="mt-8 flex flex-col gap-2 border-t border-emerald-950/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>資料為靜態快照；空白量測不視為 0。</p>
          <p>最近資料日期：{availableDates.at(-1) ?? "—"}</p>
        </footer>
      </div>
    </main>
  );
}
