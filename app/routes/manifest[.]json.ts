import { loadConfig } from "~/lib/config-loader.server";

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");

  let name = "Fitness Challenge Calculator";
  let shortName = "Fitness Calc";
  let startUrl = "/";

  if (slug) {
    try {
      const config = loadConfig(slug);
      name = config.displayName;
      shortName = config.displayName;
      startUrl = `/${slug}`;
    } catch {}
  }

  return Response.json(
    {
      name,
      short_name: shortName,
      start_url: startUrl,
      display: "standalone",
      background_color: "#f5f5f4",
      theme_color: "#f5f5f4",
      icons: [
        {
          src: "/dumbbell.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
