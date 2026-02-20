"use client";

import { useState, type FormEvent } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError("Please enter a Chess.com game URL");
      return;
    }

    setIsLoading(true);
    console.log("Analyzing URL:", url);

    // TODO: Wire up the API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Analyze a Game</CardTitle>
          <CardDescription>
            Paste a Chess.com game link to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="https://www.chess.com/game/live/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Analyzing..." : "Analyze"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
