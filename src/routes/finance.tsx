import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { PageSkeleton } from "@/components/page-skeleton";

export const Route = createFileRoute("/finance")({ head: () => ({ meta: [{ title: "Finance View — Harrow Green" }, { name: "description", content: "Fee collection, daily reconciliation, and financial reports." }, { property: "og:title", content: "Finance View — Harrow Green" }, { property: "og:description", content: "Fee collection, daily reconciliation, and financial reports." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: Page });
function Page() { return <PageSkeleton title="Finance View" description="What finance staff see: collections for the day, outstanding balances, fee settings, and reports." action="Collect payment" icon={Wallet} stats={[{label:"Collected today",value:"GH₵ 18,240",note:"34 payments"},{label:"Outstanding",value:"GH₵ 9,150",note:"58 students"},{label:"Reports",value:"4",note:"Ready to export"}]} columns={["Reference","Student","Amount","Method","Status"]} />; }
