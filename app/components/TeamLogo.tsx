import { teamColor, teamInitials } from "@/app/lib/teamColor";

/**
 * Componente riutilizzabile per il logo squadra.
 * Mostra il logo se disponibile, altrimenti le iniziali su sfondo colorato (colore fisso per squadra).
 */
export default function TeamLogo({
  logoUrl,
  teamName,
  size = "md",
  className = "",
}: {
  logoUrl?: string | null;
  teamName: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClasses = {
    xs: "w-5 h-5 text-[10px]",
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
  }[size];

  const { bg, text } = teamColor(teamName);
  const initials = teamInitials(teamName);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={teamName}
        className={`${sizeClasses} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} rounded-full ${bg} ${text} flex items-center justify-center font-bold shrink-0 ${className}`}
      title={teamName}
    >
      {initials}
    </div>
  );
}
