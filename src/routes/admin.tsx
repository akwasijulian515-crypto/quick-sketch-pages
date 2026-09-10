import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/admin")({ head: () => ({ meta: [{ title: "Admin & Roles — Harrow Green" }, { name: "description", content: "Manage accounts, assign roles, and review system activity." }, { property: "og:title", content: "Admin & Roles — Harrow Green" }, { property: "og:description", content: "Manage accounts, assign roles, and review system activity." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return <PageSkeleton title="Admin & Roles" description="Create accounts, assign the five roles, review permissions, and keep an eye on system activity." action="Invite user" icon={ShieldCheck} stats={[{label:"Accounts",value:"562",note:"Across 5 roles"},{label:"Pending invites",value:"7",note:"Sent this week"},{label:"Role changes",value:"12",note:"Last 30 days"}]} columns={["Name","Role","Linked to","Last active","Status"]} />; }
