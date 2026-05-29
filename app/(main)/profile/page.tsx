import type { Metadata } from "next";
import { getSession } from "@/app/lib/session";
import { redirect } from "next/navigation";
import ProfileClient from "./ProfileClient";

export const metadata: Metadata = { title: "Profilo" };

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return <ProfileClient username={session.username} teamName={session.teamName} />;
}
