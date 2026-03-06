import AuditLog from '../AuditLog';
import Header from '../Header';

export default function ActivityLogPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <AuditLog />
      </main>
    </div>
  );
}
