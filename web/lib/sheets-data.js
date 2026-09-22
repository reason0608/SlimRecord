const SHEETS = {
  DailyLogs: ["date", "user", "weight_kg", "body_fat_pct", "muscle_pct", "exercised", "note"],
  FoodLogs: ["id", "date", "user", "meal_type", "food_name", "quantity", "unit", "calories", "protein_g", "fat_g", "carbs_g", "note"],
  ExerciseLogs: ["date", "user", "exercise_type", "duration_minutes", "intensity", "steps", "note"],
  Goals: ["user", "day_type", "calories", "protein", "fat", "carbs", "effective_from"],
};

/** Normalize spreadsheet dates to sortable ISO dates without browser time-zone conversion. */
export function sheetDate(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match) throw new Error(`無法辨識的日期：${text}`);
  const iso = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) throw new Error(`無效日期：${text}`);
  return iso;
}

/** Keep an empty numeric cell distinct from a genuine zero. */
function numberOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(number) ? number : null;
}

function textOrNull(value) {
  return String(value ?? "").trim() || null;
}

function booleanOrNull(value) {
  if (value == null || String(value).trim() === "") return null;
  if (value === true || ["TRUE", "Y", "YES", "1", "是"].includes(String(value).trim().toUpperCase())) return true;
  if (value === false || ["FALSE", "N", "NO", "0", "否"].includes(String(value).trim().toUpperCase())) return false;
  return null;
}

function readRows(valueRange, sheetName) {
  const values = valueRange?.values ?? [];
  if (!values.length) throw new Error(`${sheetName} 工作表沒有標題列。`);
  const headers = values[0].map((header) => String(header).replace(/^\uFEFF/, "").trim());
  const missing = SHEETS[sheetName].filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`${sheetName} 缺少欄位：${missing.join("、")}`);
  return values.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
  );
}

/** Convert four normalized Google Sheets tabs into the dashboard data model. */
export function parseSheetData(valueRanges) {
  if (!Array.isArray(valueRanges) || valueRanges.length !== 4) {
    throw new Error("找不到四個必要工作表：DailyLogs、FoodLogs、ExerciseLogs、Goals。");
  }
  const [daily, food, exercise, goals] = Object.keys(SHEETS).map((name, index) => readRows(valueRanges[index], name));
  return {
    dailyLogs: daily.filter((row) => row.date && row.user).map((row) => ({
      date: sheetDate(row.date), user: String(row.user).trim(),
      weight_kg: numberOrNull(row.weight_kg), body_fat_pct: numberOrNull(row.body_fat_pct),
      muscle_pct: numberOrNull(row.muscle_pct), exercised: booleanOrNull(row.exercised),
      note: textOrNull(row.note),
    })),
    foodLogs: food.filter((row) => row.date && row.user).map((row, index) => ({
      id: String(row.id || `sheet-food-${index + 2}`), date: sheetDate(row.date),
      user: String(row.user).trim(), meal_type: textOrNull(row.meal_type),
      food_name: textOrNull(row.food_name), quantity: numberOrNull(row.quantity),
      unit: textOrNull(row.unit), calories: numberOrNull(row.calories),
      protein_g: numberOrNull(row.protein_g), fat_g: numberOrNull(row.fat_g),
      carbs_g: numberOrNull(row.carbs_g), note: textOrNull(row.note),
    })),
    exerciseLogs: exercise.filter((row) => row.date && row.user).map((row) => ({
      date: sheetDate(row.date), user: String(row.user).trim(),
      exercise_type: textOrNull(row.exercise_type), duration_minutes: numberOrNull(row.duration_minutes),
      intensity: textOrNull(row.intensity), steps: numberOrNull(row.steps), note: textOrNull(row.note),
    })),
    goals: goals.filter((row) => row.user && row.day_type && row.effective_from).map((row) => ({
      user: String(row.user).trim(),
      day_type: ["exercise", "有運動", "運動日"].includes(String(row.day_type).trim()) ? "exercise" : "rest",
      calories: numberOrNull(row.calories) ?? 0, protein: numberOrNull(row.protein) ?? 0,
      fat: numberOrNull(row.fat) ?? 0, carbs: numberOrNull(row.carbs) ?? 0,
      effective_from: sheetDate(row.effective_from),
    })),
  };
}

/** Read only dashboard tabs using the current user's short-lived OAuth access token. */
export async function fetchSheetData(accessToken, spreadsheetId, fetchImpl = fetch) {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet`);
  for (const [name, columns] of Object.entries(SHEETS)) {
    url.searchParams.append("ranges", `'${name}'!A:${String.fromCharCode(64 + columns.length)}`);
  }
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Google 登入已過期，請再次點選連線。");
    if (response.status === 403) throw new Error("無法讀取試算表。請確認登入帳號有權限，且 Google Sheets API 已啟用。");
    if (response.status === 404) throw new Error("找不到試算表，請確認試算表網址與登入帳號。");
    throw new Error(`讀取試算表失敗（HTTP ${response.status}）。`);
  }
  const payload = await response.json();
  return parseSheetData(payload.valueRanges);
}
