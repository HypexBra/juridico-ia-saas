import { Card } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <div className="skeleton h-7 w-48 rounded-md" />
        <div className="skeleton mt-2 h-4 w-64 rounded-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-8 w-16 rounded" />
            <div className="skeleton mt-3 h-3 w-20 rounded" />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="mb-4 flex items-center justify-between">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-4 w-16 rounded" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="flex items-center justify-between gap-3 border-b border-ink/10 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-3.5 w-3/5 rounded" />
                    <div className="skeleton h-3 w-2/5 rounded" />
                  </div>
                  <div className="skeleton h-5 w-16 shrink-0 rounded-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
