import CustomerLayout from "@/components/CustomerLayout";
import { MegaMenuProvider } from "@/hooks/use-mega-menu";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <MegaMenuProvider>
      <CustomerLayout>{children}</CustomerLayout>;
    </MegaMenuProvider>
  );
}
