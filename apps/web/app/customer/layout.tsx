import CustomerLayout from '@/components/CustomerLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CustomerLayout>{children}</CustomerLayout>;
}
