import { ProgrammeHeader } from "@/components/programme-header";

export default function MacclesfieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProgrammeHeader />
      {children}
    </>
  );
}
