import { useState, useMemo, useEffect, useCallback } from "react";
import { LockOpen, Lock } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "~/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const FIELDS = [
  "running",
  "biking",
  "sessionHrs",
  "heavy",
  "light",
  "mobility",
] as const;

type Field = (typeof FIELDS)[number];

const FIELD_LABELS: Record<Field, string> = {
  running: "Running (km)",
  biking: "Biking (km)",
  sessionHrs: "Session (hrs)",
  heavy: "Heavy reps",
  light: "Light reps",
  mobility: "Mobility (min)",
};

type DayData = Record<Field, string>;

const emptyDay = (): DayData =>
  Object.fromEntries(FIELDS.map((f) => [f, ""])) as DayData;

// Points conversion rates
const RATES: Record<Field, number> = {
  running: 2,
  biking: 0.25,
  sessionHrs: 2,
  heavy: 0.1,
  light: 0.05,
  mobility: 0.25,
};

const MAX_CATEGORY_POINTS = 20;

// Fields that must be whole numbers (reps)
const INTEGER_FIELDS = new Set<Field>(["heavy", "light"]);

type CategoryColor = "cardio" | "strength" | "mobility";

const CATEGORY_STYLES: Record<
  CategoryColor,
  { bg: string; bar: string; headerBg: string; dot: string }
> = {
  cardio: {
    bg: "bg-cardio-50/30 dark:bg-cardio-950/30",
    bar: "bg-cardio-500",
    headerBg: "bg-cardio-50 dark:bg-cardio-950",
    dot: "bg-cardio-500",
  },
  strength: {
    bg: "bg-strength-50/30 dark:bg-strength-950/30",
    bar: "bg-strength-500",
    headerBg: "bg-strength-50 dark:bg-strength-950",
    dot: "bg-strength-500",
  },
  mobility: {
    bg: "bg-mobility-50/30 dark:bg-mobility-950/30",
    bar: "bg-mobility-500",
    headerBg: "bg-mobility-50 dark:bg-mobility-950",
    dot: "bg-mobility-500",
  },
};

// Which fields belong to which color category
const FIELD_CATEGORY: Record<Field, CategoryColor> = {
  running: "cardio",
  biking: "cardio",
  sessionHrs: "cardio",
  heavy: "strength",
  light: "strength",
  mobility: "mobility",
};

type CategoryCalc = {
  name: string;
  fields: { field: Field; label: string; value: number; points: number }[];
  categoryFields: Field[];
  total: number;
  remaining: number;
};

function calcCategory(
  totals: Record<Field, number>,
  name: string,
  fields: Field[]
): CategoryCalc {
  const items = fields.map((field) => ({
    field,
    label: FIELD_LABELS[field],
    value: totals[field],
    points: Math.min(totals[field] * RATES[field], MAX_CATEGORY_POINTS),
  }));

  const rawTotal = fields.reduce((sum, f) => sum + totals[f] * RATES[f], 0);
  const total = Math.min(rawTotal, MAX_CATEGORY_POINTS);
  const remaining = Math.max(MAX_CATEGORY_POINTS - total, 0);

  return { name, fields: items, categoryFields: fields, total, remaining };
}

// Distribute remaining points proportionally across unlocked fields by rate.
function distributeSuggestions(
  remaining: number,
  fields: Field[],
  lockedSet: Set<Field>,
  values: Record<string, string>
): Record<Field, number> {
  const result: Record<string, number> = {};

  let lockedPoints = 0;
  const unlockedFields: Field[] = [];

  for (const f of fields) {
    if (lockedSet.has(f)) {
      const val = parseFloat(values[f]) || 0;
      result[f] = val;
      lockedPoints += val * RATES[f];
    } else {
      unlockedFields.push(f);
    }
  }

  const pointsLeft = Math.max(remaining - lockedPoints, 0);

  if (unlockedFields.length === 0 || pointsLeft === 0) {
    for (const f of unlockedFields) result[f] = 0;
    return result as Record<Field, number>;
  }

  const totalWeight = unlockedFields.reduce((sum, f) => sum + RATES[f], 0);
  for (const f of unlockedFields) {
    const share = (RATES[f] / totalWeight) * pointsLeft;
    const raw = share / RATES[f];
    // Ceil integer fields so suggestions always meet the remaining points
    result[f] = INTEGER_FIELDS.has(f)
      ? Math.ceil(raw)
      : Math.round(raw * 100) / 100;
  }

  return result as Record<Field, number>;
}

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

function NumberInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Input
      type="number"
      min="0"
      step="any"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={selectOnFocus}
      className="w-20 text-center h-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

function SuggestionBlock({
  fields,
  remaining,
}: {
  fields: Field[];
  remaining: number;
}) {
  const [lockedSet, setLockedSet] = useState<Set<Field>>(new Set());
  const [values, setValues] = useState<Record<string, string>>({});

  const suggested = useMemo(
    () => distributeSuggestions(remaining, fields, lockedSet, values),
    [remaining, fields, lockedSet, values]
  );

  function toggleLock(field: Field) {
    setLockedSet((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        // Always lock to the current displayed value (suggested or manual)
        setValues((v) => ({ ...v, [field]: String(suggested[field]) }));
        next.add(field);
      }
      return next;
    });
  }

  function handleChange(field: Field, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Auto-lock when user types
    setLockedSet((prev) => {
      if (prev.has(field)) return prev;
      const next = new Set(prev);
      next.add(field);
      return next;
    });
  }

  const unlockedCount = fields.filter((f) => !lockedSet.has(f)).length;

  return (
    <div className="space-y-1">
      {fields.map((f) => {
        const isLocked = lockedSet.has(f);
        const isLastUnlocked = !isLocked && unlockedCount === 1;
        const displayValue = isLocked
          ? values[f] ?? ""
          : suggested[f] > 0
            ? String(suggested[f])
            : "";
        return (
          <div key={f} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {FIELD_LABELS[f]}
            </span>
            <Input
              type="number"
              min="0"
              step="any"
              readOnly={isLastUnlocked}
              value={displayValue}
              onChange={(e) => handleChange(f, e.target.value)}
              onFocus={selectOnFocus}
              className={`w-20 text-center h-7 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isLastUnlocked ? "bg-muted" : ""
              }`}
            />
            {isLastUnlocked ? (
              <Popover>
                <PopoverTrigger
                  className="p-1 rounded-sm text-foreground/40 hover:text-foreground transition-colors"
                >
                  <LockOpen className="size-3.5" />
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-3 py-2 text-xs">
                  Last field can't be locked
                </PopoverContent>
              </Popover>
            ) : (
              <button
                type="button"
                onClick={() => toggleLock(f)}
                className={`p-1 rounded-sm transition-colors ${
                  isLocked
                    ? "text-primary"
                    : "text-foreground/40 hover:text-foreground"
                }`}
                title={isLocked ? "Unlock" : "Lock"}
              >
                {isLocked ? (
                  <Lock className="size-3.5" />
                ) : (
                  <LockOpen className="size-3.5" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CategoryCard({
  calc,
  color,
}: {
  calc: CategoryCalc;
  color: CategoryColor;
}) {
  const pct = (calc.total / MAX_CATEGORY_POINTS) * 100;

  return (
    <Card className={CATEGORY_STYLES[color].bg}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${CATEGORY_STYLES[color].dot}`} />
            <CardTitle className="text-base">{calc.name}</CardTitle>
          </div>
          <span className="text-sm font-medium tabular-nums">
            {calc.total.toFixed(1)} / {MAX_CATEGORY_POINTS} pts
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${CATEGORY_STYLES[color].bar} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {calc.fields.map((f) => (
            <div
              key={f.field}
              className="flex justify-between text-sm tabular-nums"
            >
              <span>{f.label}</span>
              <span>
                {f.value > 0 ? f.value : "—"} → {f.points.toFixed(1)} pts
              </span>
            </div>
          ))}
        </div>

        {calc.remaining > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium">
              Suggestions ({calc.remaining.toFixed(1)} pts remaining)
            </p>
            {calc.categoryFields.length > 1 ? (
              <SuggestionBlock
                fields={calc.categoryFields}
                remaining={calc.remaining}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {FIELD_LABELS[calc.categoryFields[0]]}
                </span>
                <span className="w-20 text-center tabular-nums">
                  {Math.round((calc.remaining / RATES[calc.categoryFields[0]]) * 100) / 100}
                </span>
                <span className="p-1 size-3.5" />
              </div>
            )}
          </div>
        )}

        {calc.remaining === 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-green-600 dark:text-green-400">Maxed out!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const STORAGE_KEY = "conrad-weekly-tracker";

function loadDays(): Record<string, DayData> {
  if (typeof window === "undefined") return emptyWeek();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return emptyWeek();
}

function emptyWeek(): Record<string, DayData> {
  return Object.fromEntries(DAYS.map((d) => [d, emptyDay()]));
}

export function WeeklyTracker() {
  const [days, setDays] = useState<Record<string, DayData>>(emptyWeek);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage after hydration
  useEffect(() => {
    setDays(loadDays());
    setHydrated(true);
  }, []);

  // Persist to localStorage on change (skip initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  }, [days, hydrated]);

  function updateDay(day: string, field: Field, value: string) {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  const clearAll = useCallback(() => {
    setDays(emptyWeek());
  }, []);

  const totals = useMemo(() => {
    const sums = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<
      Field,
      number
    >;
    for (const day of DAYS) {
      for (const field of FIELDS) {
        sums[field] += parseFloat(days[day][field]) || 0;
      }
    }
    return sums;
  }, [days]);

  const cardio = useMemo(
    () =>
      calcCategory(totals, "Cardio", ["running", "biking", "sessionHrs"]),
    [totals]
  );
  const strength = useMemo(
    () => calcCategory(totals, "Strength", ["heavy", "light"]),
    [totals]
  );
  const mobility = useMemo(
    () => calcCategory(totals, "Mobility", ["mobility"]),
    [totals]
  );

  const totalPoints = cardio.total + strength.total + mobility.total;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weekly calculator</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={clearAll}>
            Clear all
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Day</TableHead>
              {FIELDS.map((f) => (
                <TableHead
                  key={f}
                  className={`text-center ${CATEGORY_STYLES[FIELD_CATEGORY[f]].headerBg}`}
                >
                  {FIELD_LABELS[f]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day) => (
              <TableRow key={day}>
                <TableCell className="font-medium">{day}</TableCell>
                {FIELDS.map((field) => (
                  <TableCell key={field} className={`text-center ${CATEGORY_STYLES[FIELD_CATEGORY[field]].bg}`}>
                    <NumberInput
                      value={days[day][field]}
                      onChange={(v) => updateDay(day, field, v)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-bold">Total</TableCell>
              {FIELDS.map((f) => (
                <TableCell key={f} className={`text-center font-bold tabular-nums ${CATEGORY_STYLES[FIELD_CATEGORY[f]].bg}`}>
                  {totals[f] > 0 ? totals[f] : "—"}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Points breakdown</h2>
        <p className="text-lg font-bold tabular-nums">
          {totalPoints.toFixed(1)} / 60 pts
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CategoryCard calc={cardio} color="cardio" />
        <CategoryCard calc={strength} color="strength" />
        <CategoryCard calc={mobility} color="mobility" />
      </div>
    </div>
  );
}
