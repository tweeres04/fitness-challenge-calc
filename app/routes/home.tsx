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
    <div className="flex min-h-screen flex-col bg-stone-50">
      <div className="mx-auto max-w-4xl flex-1 px-4 py-8">
        <WeeklyTracker />
      </div>
      <footer className="py-6 text-center text-sm text-stone-400">
        <p>By <a href="https://tweeres.ca" className="underline hover:text-stone-600">Tyler Weeres</a></p>
        <p>
          <a
            href="https://www.flaticon.com/free-icons/fitness"
            title="fitness icons"
            className="underline hover:text-stone-600"
          >
            Fitness icons created by juicy_fish - Flaticon
          </a>
        </p>
      </footer>
    </div>
  );
}
