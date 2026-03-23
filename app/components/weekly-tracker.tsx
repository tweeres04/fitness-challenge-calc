import { useState, useMemo, useEffect } from "react";
import { CircleHelp, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

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
  return FIELD_UNITS[f]
    ? `${FIELD_NAMES[f]} (${FIELD_UNITS[f]})`
    : FIELD_NAMES[f];
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
  fields: Field[],
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
    0,
  );
  const total = Math.min(rawTotal, MAX_CATEGORY_POINTS);
  const remaining = Math.max(MAX_CATEGORY_POINTS - total, 0);

  return { name, fields: items, categoryFields: fields, total, remaining };
}

// How many more units of a field can be suggested, given what's already tracked
function fieldHeadroom(field: Field, totals: Record<Field, number>): number {
  return Math.max(FIELD_MAX[field] - totals[field], 0);
}

// Calculate the primary field value from remaining points minus secondary inputs.
// First field is always the primary (auto-calculated), rest are secondary (user-editable).
function calcPrimaryValue(
  remaining: number,
  primaryField: Field,
  secondaryValues: Record<string, string>,
  fields: Field[],
  totals: Record<Field, number>,
): number {
  const secondaryPoints = fields
    .filter((f) => f !== primaryField)
    .reduce((sum, f) => {
      const val = Math.min(
        parseFloat(secondaryValues[f]) || 0,
        fieldHeadroom(f, totals),
      );
      return sum + val * RATES[f];
    }, 0);

  const pointsLeft = Math.max(remaining - secondaryPoints, 0);
  const raw = Math.min(
    pointsLeft / RATES[primaryField],
    fieldHeadroom(primaryField, totals),
  );
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
      className="w-20 h-8 text-center"
    />
  );
}

function SuggestionBlock({
  fields,
  remaining,
  totals,
}: {
  fields: Field[];
  remaining: number;
  totals: Record<Field, number>;
}) {
  const primaryField = fields[0];
  const secondaryFields = fields.slice(1);
  const [secondaryValues, setSecondaryValues] = useState<
    Record<string, string>
  >({});
  const [clampedField, setClampedField] = useState<Field | null>(null);

  const primaryValue = useMemo(
    () =>
      calcPrimaryValue(
        remaining,
        primaryField,
        secondaryValues,
        fields,
        totals,
      ),
    [remaining, primaryField, secondaryValues, fields, totals],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="flex-1">
          {FIELD_NAMES[primaryField]}
          {FIELD_UNITS[primaryField] && (
            <span className="block text-xs text-foreground/50">
              {FIELD_UNITS[primaryField]}
            </span>
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
        const headroom = fieldHeadroom(f, totals);
        const maxedOut = headroom <= 0;
        const val = Math.min(parseFloat(secondaryValues[f]) || 0, headroom);
        const pts = val * RATES[f];
        return (
          <div key={f} className="flex items-center gap-2 text-sm">
            <span className="flex-1">
              {FIELD_NAMES[f]}
              {FIELD_UNITS[f] && (
                <span className="block text-xs text-foreground/50">
                  {FIELD_UNITS[f]}
                </span>
              )}
            </span>
            {maxedOut ? (
              <Popover>
                <PopoverTrigger className="w-20 text-center tabular-nums h-7 flex items-center justify-center text-foreground/50 cursor-help">
                  0
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-3 py-2 text-xs">
                  Already at max ({FIELD_MAX[f]} {FIELD_UNITS[f] || "reps"})
                </PopoverContent>
              </Popover>
            ) : (
              <Popover
                open={clampedField === f}
                onOpenChange={(open) => {
                  if (!open) setClampedField(null);
                }}
              >
                <PopoverTrigger
                  render={
                    <Input
                      type="number"
                      min="0"
                      max={headroom}
                      step="any"
                      value={secondaryValues[f] ?? ""}
                      onChange={(e) =>
                        setSecondaryValues((prev) => ({
                          ...prev,
                          [f]: e.target.value,
                        }))
                      }
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (v > headroom) {
                          setSecondaryValues((prev) => ({
                            ...prev,
                            [f]: String(headroom),
                          }));
                          setTimeout(() => setClampedField(f), 100);
                        }
                      }}
                      onFocus={selectOnFocus}
                      className="w-20 h-7 text-sm text-center"
                    />
                  }
                />
                <PopoverContent side="top" className="w-auto px-3 py-2 text-xs">
                  Clamped to {headroom}{" "}
                  {FIELD_UNITS[f] || (headroom === 1 ? "rep" : "reps")}{" "}
                  remaining
                </PopoverContent>
              </Popover>
            )}
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
  totals,
}: {
  calc: CategoryCalc;
  color: CategoryColor;
  totals: Record<Field, number>;
}) {
  const pct = (calc.total / MAX_CATEGORY_POINTS) * 100;

  return (
    <Card className={CATEGORY_STYLES[color].bg}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${CATEGORY_STYLES[color].dot}`}
            />
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
                totals={totals}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {FIELD_NAMES[calc.categoryFields[0]]}
                  {FIELD_UNITS[calc.categoryFields[0]] && (
                    <span className="block text-xs text-foreground/50">
                      {FIELD_UNITS[calc.categoryFields[0]]}
                    </span>
                  )}
                </span>
                <span className="w-20 text-center tabular-nums h-7 flex items-center justify-center">
                  {Math.round(
                    (calc.remaining / RATES[calc.categoryFields[0]]) * 100,
                  ) / 100}
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
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Maxed out!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CATEGORIES: { name: string; color: CategoryColor; fields: Field[] }[] = [
  {
    name: "Cardio",
    color: "cardio",
    fields: ["running", "biking", "sessionHrs"],
  },
  { name: "Strength", color: "strength", fields: ["heavy", "light"] },
  { name: "Mobility", color: "mobility", fields: ["mobility"] },
];

function fieldRuleLabel(f: Field): string {
  const unit = FIELD_UNITS[f] || "rep";
  const rate = `${RATES[f]} pts/${unit}`;
  const max = FIELD_MAX[f];
  if (max === Infinity) return `${FIELD_NAMES[f]}: ${rate}`;
  const maxPts = max * RATES[f];
  return `${FIELD_NAMES[f]}: ${rate} (max ${max} ${unit}${max !== 1 ? "s" : ""}, ${maxPts} pts)`;
}

function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost">
            <CircleHelp className="size-4" />
            <span className="hidden sm:inline">Rules</span>
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Scoring rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p>
            Each week you can earn up to{" "}
            <strong>{MAX_CATEGORY_POINTS * CATEGORIES.length} points</strong>{" "}
            across {CATEGORIES.length} categories, each worth a maximum of{" "}
            <strong>{MAX_CATEGORY_POINTS} points</strong>.
          </p>

          {CATEGORIES.map((cat) => (
            <div key={cat.name}>
              <h3 className="font-semibold mb-1">
                {cat.name} ({MAX_CATEGORY_POINTS} pts max)
              </h3>
              <ul className="space-y-0.5 ml-4 list-disc">
                {cat.fields.map((f) => (
                  <li key={f}>{fieldRuleLabel(f)}</li>
                ))}
              </ul>
            </div>
          ))}

          <p>
            Hit all {MAX_CATEGORY_POINTS * CATEGORIES.length} points in a week
            to earn a <strong>max week bonus ticket</strong> for the prize draw.
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
    () => calcCategory(totals, "Cardio", ["running", "biking", "sessionHrs"]),
    [totals],
  );
  const strength = useMemo(
    () => calcCategory(totals, "Strength", ["heavy", "light"]),
    [totals],
  );
  const mobility = useMemo(
    () => calcCategory(totals, "Mobility", ["mobility"]),
    [totals],
  );

  const totalPoints = cardio.total + strength.total + mobility.total;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Weekly calculator</h1>
        <div className="flex items-center gap-2">
          <RulesDialog />
          <ThemeToggle />
          <Button variant="outline" onClick={clearAll}>
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">Clear all</span>
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
                  <TableCell
                    key={field}
                    className={`text-center ${FIELD_GRADIENT_BG[field] ?? CATEGORY_STYLES[FIELD_CATEGORY[field]].bg}`}
                  >
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
                <TableCell
                  key={f}
                  className={`text-center font-bold tabular-nums ${FIELD_GRADIENT_BG[f] ?? CATEGORY_STYLES[FIELD_CATEGORY[f]].bg}`}
                >
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
        <CategoryCard calc={cardio} color="cardio" totals={totals} />
        <CategoryCard calc={strength} color="strength" totals={totals} />
        <CategoryCard calc={mobility} color="mobility" totals={totals} />
      </div>
    </div>
  );
}
