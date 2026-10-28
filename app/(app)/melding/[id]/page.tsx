"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { PublicReport } from "@/lib/types";
import { ReportDetail } from "@/components/citizen/report-detail";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/utils";

export default function MeldingPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = React.useState<PublicReport | null | undefined>(undefined);

  React.useEffect(() => {
    api<{ report: PublicReport }>(`/api/reports/${id}`)
      .then((d) => setReport(d.report))
      .catch(() => setReport(null));
  }, [id]);

  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 py-6">
      <Link href="/logboek" className={buttonVariants({ variant: "ghost", size: "sm", className: "w-fit -ml-2" })}>
        <ArrowLeft /> Terug
      </Link>
      {report === undefined ? (
        <Skeleton className="h-96" />
      ) : report === null ? (
        <EmptyState title="Deze melding is niet gevonden">Misschien is hij ingetrokken of niet openbaar.</EmptyState>
      ) : (
        <div className="rounded-xl border p-5">
          <ReportDetail report={report} />
        </div>
      )}
    </div>
  );
}
