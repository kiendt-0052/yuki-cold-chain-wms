import { Suspense } from "react";
import { Loading } from "@/components/ui";
import { OrderDetail } from "./order-detail";

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <OrderDetail params={params} />
    </Suspense>
  );
}
