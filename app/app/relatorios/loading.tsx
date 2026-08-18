import { Card } from "@/components/ui/card";

export default function RelatoriosLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-40 rounded-md" />
        <div className="skeleton mt-2 h-4 w-80 rounded-md" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="mb-3 flex items-center justify-between">
              <div className="skeleton h-5 w-28 rounded" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-2">
                  <div className="skeleton h-3 w-14 rounded" />
                  <div className="skeleton h-5 w-8 rounded" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
