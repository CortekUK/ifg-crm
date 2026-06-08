import type { Metadata } from "next";
import { StaffView } from "@/components/staff";

export const metadata: Metadata = {
  title: "Coaches & Staff · Macclesfield",
  description:
    "Meet the leadership, recruiters, physios and coaches of The International Football Group at Macclesfield FC.",
};

export default function Page() {
  return <StaffView />;
}
