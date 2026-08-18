import { Card } from "@/components/ui/card";

export default function FinanceiroLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="skeleton h-7 w-32 rounded-md" />
          <div className="skeleton mt-2 h-4 w-72 rounded-md" />
        </div>
        <div className="skeleton h-10 w-36 rounded-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton mt-3 h-8 w-28 rounded" />
            <div className="skeleton mt-3 h-3 w-32 rounded" />
          </Card>
        ))}
      </div>

      <div>
        <div className="skeleton mb-4 h-5 w-32 rounded" />
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <div className="skeleton h-5 w-40 rounded" />
              <div className="skeleton mt-4 h-16 w-full rounded" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
