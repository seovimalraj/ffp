import { AddressCard } from "@/app/portal/orders/[orderId]/page";
import { FlowConnector } from "./animated-connector";
import Logo from "./logo";

export const AddressFlow = ({
  to,
}: {
  to: React.ComponentProps<typeof AddressCard>;
}) => (
  <div className="flex items-center gap-4">
    <div className="h-16 px-3 rounded flex items-center justify-center">
      <Logo classNames="aspect-video w-full h-full object-contain" />
    </div>
    <div className="flex items-center justify-center">
      <FlowConnector />
    </div>

    <AddressCard {...to} />
  </div>
);
