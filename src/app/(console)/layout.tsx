import type { ReactNode } from "react";
import { JobProvider } from "@/components/job/JobProvider";
import { AppShell } from "@/components/shell/AppShell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <JobProvider>
      <AppShell>{children}</AppShell>
    </JobProvider>
  );
}
