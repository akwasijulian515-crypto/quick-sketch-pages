import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/student")({ head: () => ({ meta: [{ title: "Student View — Harrow Green" }, { name: "description", content: "A student's own attendance, grades, payments, and notifications." }, { property: "og:title", content: "Student View — Harrow Green" }, { property: "og:description", content: "A student's own attendance, grades, payments, and notifications." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return <PageSkeleton title="Student View" description="What a signed-in student sees: their own class, attendance summary, grades, payment balance, and notices." action="Make payment" icon={GraduationCap} stats={[{label:"Attendance",value:"94%",note:"Present 61 of 65 days"},{label:"Average score",value:"78%",note:"Across 6 subjects"},{label:"Balance",value:"GH₵ 120",note:"Last paid 12 May"}]} columns={["Area","Detail","Latest update","Status"]} />; }
