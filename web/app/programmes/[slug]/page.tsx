import { redirect } from "next/navigation";

// Legacy group-programme detail pages (Juventus, Phoenix) are retired — IFG no
// longer runs them. Any old link lands on the homepage instead of a dead page.
export default async function Page() {
  redirect("/");
}
