import { redirect } from "next/navigation";

/** Old post-launch destination — the dashboard replaced it. Kept for links. */
export default function LaunchedPage() {
  redirect("/dashboard");
}
