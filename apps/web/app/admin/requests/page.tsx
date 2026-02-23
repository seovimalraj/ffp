import TechSupportRequestsTable from "@/components/requests/tech-support-requests-table";

export default function AdminRequestsPage() {
  return (
    <div className="min-h-screen space-y-4">
      <TechSupportRequestsTable role="admin" rfqId="all" />
    </div>
  );
}
