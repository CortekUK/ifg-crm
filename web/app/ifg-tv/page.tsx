import type { Metadata } from "next";
import { IFGTVView } from "@/components/ifg-tv";

export const metadata: Metadata = {
  title: "IFG TV",
  description:
    "IFG TV — match footage, player stories and behind-the-scenes films from The International Football Group. Watch and subscribe on YouTube.",
};

export default function Page() {
  return <IFGTVView />;
}
