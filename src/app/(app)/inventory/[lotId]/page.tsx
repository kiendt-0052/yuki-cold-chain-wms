import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { LotDetail } from "./lot-detail";

export default function LotPage({ params }: PageProps<"/inventory/[lotId]">) {
  return (
    <Suspense fallback={<Loading />}>
      <LotDetail params={params} />
    </Suspense>
  );
}
