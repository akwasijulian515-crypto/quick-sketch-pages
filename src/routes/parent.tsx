import { createFileRoute } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/parent")({ head: () => ({ meta: [{ title: "Parent View — Harrow Green" }, { name: "description", content: "A parent's view of each child's attendance, grades, and payments." }, { property: "og:title", content: "Parent View — Harrow Green" }, { property: "og:description", content: "A parent's view of each child's attendance, grades, and payments." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return <PageSkeleton title="Parent View" description="What a signed-in parent sees: each linked child's attendance, grades, balance, and payment options." action="Pay fees" icon={HeartHandshake} stats={[{label:"Children",value:"2",note:"Forms 1A and 3C"},{label:"Outstanding",value:"GH₵ 340",note:"Due this week"},{label:"Notices",value:"3",note:"2 unread"}]} columns={["Child","Class","Attendance","Balance","Latest notice"]} />; }
