import { Link } from "react-router";
import type { Route } from "./+types/home";
import { listConfigs } from "~/lib/config-loader.server";
import { ThemeToggle } from "~/components/theme-toggle";
import { PageLayout } from "~/components/page-layout";

export function loader() {
  return { configs: listConfigs() };
}

export function meta() {
  return [
    { title: "Fitness Challenge Calculator" },
    { name: "description", content: "Weekly fitness challenge calculator" },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <PageLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fitness challenges</h1>
          <ThemeToggle />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {loaderData.configs.map((c) => (
            <Link
              key={c.slug}
              to={`/${c.slug}`}
              className="block rounded-lg border p-6 hover:bg-accent transition-colors"
            >
              <h2 className="text-lg font-semibold">{c.displayName}</h2>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
