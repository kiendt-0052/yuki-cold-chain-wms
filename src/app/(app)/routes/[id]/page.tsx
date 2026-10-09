import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { RouteEditor } from "./route-editor";

export default function RoutePage({ params }: PageProps<"/routes/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <RouteEditor params={params} />
    </Suspense>
  );
}
