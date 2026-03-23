import { useState, useMemo, useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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

const FIELD_NAMES: Record<Field, string> = {
  running: "Running",
  biking: "Biking",
  sessionHrs: "Session",
  heavy: "Heavy reps",
  light: "Light reps",
  mobility: "Mobility",
};

const FIELD_UNITS: Record<Field, string> = {
  running: "km",
  biking: "km",
  sessionHrs: "hrs",
  heavy: "",
  light: "",
  mobility: "min",
};

function fieldLabel(f: Field): string {
  return FIELD_UNITS[f] ? `${FIELD_NAMES[f]} (${FIELD_UNITS[f]})` : FIELD_NAMES[f];
}

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

// Per-field maximums (in units, not points)
const FIELD_MAX: Record<Field, number> = {
  running: Infinity,
  biking: 40,
  sessionHrs: 2,
  heavy: Infinity,
  light: 200,
  mobility: Infinity,
};

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

// Gradient overrides for transition columns (header and body cells)
const FIELD_GRADIENT_HEADER: Partial<Record<Field, string>> = {
  running: "bg-gradient-cardio-start-header",
  sessionHrs: "bg-gradient-cardio-end-header",
  heavy: "bg-gradient-strength-start-header",
  light: "bg-gradient-strength-end-header",
  mobility: "bg-gradient-mobility-start-header",
};

const FIELD_GRADIENT_BG: Partial<Record<Field, string>> = {
  running: "bg-gradient-cardio-start-body",
  sessionHrs: "bg-gradient-cardio-end-body",
  heavy: "bg-gradient-strength-start-body",
  light: "bg-gradient-strength-end-body",
  mobility: "bg-gradient-mobility-start-body",
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
  const items = fields.map((field) => {
    const clamped = Math.min(totals[field], FIELD_MAX[field]);
    return {
      field,
      label: fieldLabel(field),
      value: totals[field],
      points: Math.min(clamped * RATES[field], MAX_CATEGORY_POINTS),
    };
  });

  const rawTotal = fields.reduce(
    (sum, f) => sum + Math.min(totals[f], FIELD_MAX[f]) * RATES[f],
    0
  );
  const total = Math.min(rawTotal, MAX_CATEGORY_POINTS);
  const remaining = Math.max(MAX_CATEGORY_POINTS - total, 0);

  return { name, fields: items, categoryFields: fields, total, remaining };
}

// Calculate the primary field value from remaining points minus secondary inputs.
// First field is always the primary (auto-calculated), rest are secondary (user-editable).
function calcPrimaryValue(
  remaining: number,
  primaryField: Field,
  secondaryValues: Record<string, string>,
  fields: Field[]
): number {
  const secondaryPoints = fields
    .filter((f) => f !== primaryField)
    .reduce((sum, f) => {
      const val = Math.min(parseFloat(secondaryValues[f]) || 0, FIELD_MAX[f]);
      return sum + val * RATES[f];
    }, 0);

  const pointsLeft = Math.max(remaining - secondaryPoints, 0);
  const raw = Math.min(pointsLeft / RATES[primaryField], FIELD_MAX[primaryField]);
  return INTEGER_FIELDS.has(primaryField)
    ? Math.ceil(raw)
    : Math.round(raw * 100) / 100;
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
  const primaryField = fields[0];
  const secondaryFields = fields.slice(1);
  const [secondaryValues, setSecondaryValues] = useState<Record<string, string>>({});

  const primaryValue = useMemo(
    () => calcPrimaryValue(remaining, primaryField, secondaryValues, fields),
    [remaining, primaryField, secondaryValues, fields]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">
          {FIELD_NAMES[primaryField]}
          {FIELD_UNITS[primaryField] && (
            <span className="block text-xs text-foreground/50">{FIELD_UNITS[primaryField]}</span>
          )}
        </span>
        <span className="w-20 text-center tabular-nums h-7 flex items-center justify-center">
          {primaryValue > 0 ? primaryValue : "—"}
        </span>
        <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
          {primaryValue > 0
            ? `${(primaryValue * RATES[primaryField]).toFixed(1)} pts`
            : ""}
        </span>
      </div>
      {secondaryFields.map((f) => {
        const val = parseFloat(secondaryValues[f]) || 0;
        const pts = val * RATES[f];
        return (
          <div key={f} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {FIELD_NAMES[f]}
              {FIELD_UNITS[f] && (
                <span className="block text-xs text-foreground/50">{FIELD_UNITS[f]}</span>
              )}
            </span>
            <Input
              type="number"
              min="0"
              step="any"
              value={secondaryValues[f] ?? ""}
              onChange={(e) =>
                setSecondaryValues((prev) => ({ ...prev, [f]: e.target.value }))
              }
              onFocus={selectOnFocus}
              className="w-20 text-center h-7 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
              {pts > 0 ? `${pts.toFixed(1)} pts` : ""}
            </span>
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
                  {FIELD_NAMES[calc.categoryFields[0]]}
                  {FIELD_UNITS[calc.categoryFields[0]] && (
                    <span className="block text-xs text-foreground/50">{FIELD_UNITS[calc.categoryFields[0]]}</span>
                  )}
                </span>
                <span className="w-20 text-center tabular-nums h-7 flex items-center justify-center">
                  {Math.round((calc.remaining / RATES[calc.categoryFields[0]]) * 100) / 100}
                </span>
                <span className="w-16 text-right text-xs tabular-nums text-foreground/50">
                  {calc.remaining.toFixed(1)} pts
                </span>
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

function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm">
            <CircleHelp className="size-4" />
            Rules
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scoring rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>
            Each week you can earn up to <strong>60 points</strong> across three
            categories, each worth a maximum of <strong>20 points</strong>.
          </p>

          <div>
            <h3 className="font-semibold mb-1">Cardio (20 pts max)</h3>
            <ul className="space-y-0.5 ml-4 list-disc">
              <li>Running: 2 pts/km</li>
              <li>Biking: 0.25 pts/km (max 40 km, 10 pts)</li>
              <li>Session: 2 pts/hr (max 2 hrs, 4 pts)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Strength (20 pts max)</h3>
            <ul className="space-y-0.5 ml-4 list-disc">
              <li>Heavy reps: 0.1 pts/rep</li>
              <li>Light reps: 0.05 pts/rep (max 200 reps, 10 pts)</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Mobility (20 pts max)</h3>
            <ul className="space-y-0.5 ml-4 list-disc">
              <li>Minutes: 0.25 pts/min</li>
            </ul>
          </div>

          <p>
            Hit all 60 points in a week to earn a <strong>max week bonus
            ticket</strong> for the prize draw.
          </p>
        </div>
      </DialogContent>
    </Dialog>
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

  function clearAll() {
    setDays(emptyWeek());
  }

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
          <RulesDialog />
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
                  className={`text-center ${FIELD_GRADIENT_HEADER[f] ?? CATEGORY_STYLES[FIELD_CATEGORY[f]].headerBg}`}
                >
                  {fieldLabel(f)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {DAYS.map((day) => (
              <TableRow key={day}>
                <TableCell className="font-medium">{day}</TableCell>
                {FIELDS.map((field) => (
                  <TableCell key={field} className={`text-center ${FIELD_GRADIENT_BG[field] ?? CATEGORY_STYLES[FIELD_CATEGORY[field]].bg}`}>
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
                <TableCell key={f} className={`text-center font-bold tabular-nums ${FIELD_GRADIENT_BG[f] ?? CATEGORY_STYLES[FIELD_CATEGORY[f]].bg}`}>
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
