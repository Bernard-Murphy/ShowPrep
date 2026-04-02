"use client";

import { useParams } from "next/navigation";
import { ProfileContent } from "@/components/profile-content";

export default function ProfilePage() {
  const params = useParams();
  const id = params?.id as string;
  if (!id) return null;
  return <ProfileContent userId={id} />;
}
