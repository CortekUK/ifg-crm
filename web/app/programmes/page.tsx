import type { Metadata } from "next";
import { ProgrammesView } from "@/components/programmes";

export const metadata: Metadata = {
  title: "Programmes",
  description: "Choose your pathway — football-specific routes and broader sports careers, each delivered with a world-renowned club or university partner.",
};

export default function Page() {
  return <ProgrammesView />;
}
