import { useSearchParams } from 'react-router-dom';
import AuditLog from '../AuditLog';
import Header from '../Header';

export default function ActivityLogPage() {
  const [searchParams] = useSearchParams();
  const transIdParam = searchParams.get('trans_id');
  const highlightTransId = transIdParam ? parseInt(transIdParam, 10) : undefined;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <AuditLog highlightTransId={highlightTransId} />
      </main>
    </div>
  );
}
