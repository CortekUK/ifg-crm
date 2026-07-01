import { redirect } from "next/navigation";

// The Macclesfield education page is now the main homepage. Keep this URL alive
// (ads/bookmarks) by sending it to the merged home.
export default function Page() {
  redirect("/");
}
