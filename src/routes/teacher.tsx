import { createFileRoute } from "@tanstack/react-router";
import { UserRoundCheck } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/teacher")({ head: () => ({ meta: [{ title: "Teacher View — Harrow Green" }, { name: "description", content: "A teacher's class register, grade entry, and coupon tools." }, { property: "og:title", content: "Teacher View — Harrow Green" }, { property: "og:description", content: "A teacher's class register, grade entry, and coupon tools." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return <PageSkeleton title="Teacher View" description="What a signed-in teacher sees: their assigned class, today's register, grade entry, and coupon generation." action="Mark register" icon={UserRoundCheck} stats={[{label:"My class",value:"Form 2B",note:"42 students"},{label:"Marked today",value:"38",note:"4 outstanding"},{label:"Grades pending",value:"2",note:"Subjects to submit"}]} columns={["Student","Attendance","Latest grade","Payment","Action"]} />; }
