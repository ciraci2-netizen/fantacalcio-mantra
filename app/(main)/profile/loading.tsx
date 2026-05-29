import { SkeletonCard } from "@/app/components/SkeletonCard";

export default function ProfileLoading() {
  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="w-32 h-7 bg-gray-200 rounded animate-pulse" />
      <SkeletonCard rows={5} />
      <SkeletonCard rows={3} />
    </div>
  );
}
