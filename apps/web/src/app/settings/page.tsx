"use client";

import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p>Sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Logged in as {user.displayName || "User"}</p>
          <div>
            <h3 className="font-medium mb-2">YouTube</h3>
            <p className="text-sm text-muted-foreground mb-2">Link your YouTube account to sync subscriptions and generate content.</p>
            <Button variant="outline" size="sm">Link YouTube</Button>
          </div>
          <div>
            <h3 className="font-medium mb-2">Voices</h3>
            <p className="text-sm text-muted-foreground">Manage default and custom voices for gencasts.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
