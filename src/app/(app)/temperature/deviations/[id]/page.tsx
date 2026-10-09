import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { DeviationDetail } from "./deviation-detail";

export default function DeviationPage({ params }: PageProps<"/temperature/deviations/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <DeviationDetail params={params} />
    </Suspense>
  );
}
