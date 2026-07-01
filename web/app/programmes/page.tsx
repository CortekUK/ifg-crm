import { redirect } from "next/navigation";

// Programmes now live directly on the homepage (one clean structure). Keep this
// URL alive by redirecting to home.
export default function Page() {
  redirect("/");
}
