import { createFileRoute } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Klasora | School operations" },
      { name: "description", content: "School attendance, payments, grades, classes, and student operations." },
      { property: "og:title", content: "Klasora | School operations" },
      { property: "og:description", content: "A clear workspace for daily school operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
