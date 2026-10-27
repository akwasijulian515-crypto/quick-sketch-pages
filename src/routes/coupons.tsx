import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/coupons")({
  beforeLoad: () => {
    throw redirect({ to: "/daily-payments" });
  },
});
