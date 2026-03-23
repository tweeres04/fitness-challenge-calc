import type { Route } from "./+types/home";
import { WeeklyTracker } from "~/components/weekly-tracker";


export function meta({}: Route.MetaArgs) {
  return [
    { title: "Fitness Challenge Calculator" },
    {
      name: "description",
      content: "Weekly fitness challenge calculator",
    },
  ];
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 dark:bg-background">
      <div className="mx-auto max-w-4xl flex-1 px-4 py-8">
        <WeeklyTracker />
      </div>
      <footer className="py-6 text-center text-sm text-foreground/40">
        <p>By <a href="https://tweeres.ca" className="underline hover:text-foreground/60">Tyler Weeres</a></p>
        <p>
          <a
            href="https://www.flaticon.com/free-icons/fitness"
            title="fitness icons"
            className="underline hover:text-foreground/60"
          >
            Fitness icons created by juicy_fish - Flaticon
          </a>
        </p>
      </footer>
    </div>
  );
}
