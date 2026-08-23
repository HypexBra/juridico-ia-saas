import { Card } from "@/components/ui/card";

export default function UsoIaLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-32 rounded-md" />
        <div className="skeleton mt-2 h-4 w-72 rounded-md" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton mt-2 h-6 w-16 rounded" />
            <div className="skeleton mt-2 h-2.5 w-24 rounded" />
          </Card>
        ))}
      </div>

      {[0, 1].map((i) => (
        <Card key={`card-${i}`}>
          <div className="skeleton mb-4 h-5 w-44 rounded" />
          <div className="space-y-2.5">
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <div key={j} className="flex items-center gap-2">
                <div className="skeleton h-3 w-10 rounded" />
                <div className="skeleton h-3 flex-1 rounded-sm" style={{ width: `${90 - j * 8}%` }} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
