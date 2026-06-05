import type { Metadata } from "next";
import { AboutView } from "@/components/about";

export const metadata: Metadata = {
  title: "About",
  description: "The International Football Group integrates education and football experience, forging collaborations with the foremost names in global football.",
};

export default function Page() {
  return <AboutView />;
}
