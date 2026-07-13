import { redirect } from "next/navigation";

export default function ParentActivityPage() {
  redirect("/login?notice=parent-mobile-only");
}
