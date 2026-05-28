import { SkeletonHero, SkeletonCard, SkeletonTable } from "@/app/components/SkeletonCard";

export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <SkeletonHero />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonCard rows={3} />
        <SkeletonTable rows={5} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <SkeletonCard rows={5} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  );
}
