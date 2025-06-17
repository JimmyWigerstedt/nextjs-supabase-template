"use client";
import { useState, useEffect } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";

export function N8nDemoClient() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uid, setUid] = useState("demo-user");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [dbPing, setDbPing] = useState<string | null>(null);

  const { refetch: pingInternalDb } = clientApi.internal.testConnection.useQuery(
    undefined,
    { enabled: false },
  );

  useEffect(() => {
    const source = new EventSource(`/api/stream/user-updates?uid=${uid}`);
    source.onmessage = (ev) => {
      setLastUpdate(ev.data);
    };
    return () => {
      source.close();
    };
  }, [uid]);

  const { mutate: processWorkflow } = clientApi.n8n.template.processTemplate.useMutation({
    onSuccess: () => {
      toast.success("Workflow completed successfully!");
      setIsProcessing(false);
    },
    onError: (error) => {
      toast.error(`Workflow failed: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const handleProcessWorkflow = () => {
    setIsProcessing(true);
    processWorkflow({
      data: { sample: "data" },
      action: "process",
    });
  };

  const handlePingDb = async () => {
    const res = await pingInternalDb();
    if (res.data?.timestamp) {
      setDbPing(res.data.timestamp.toString());
      toast.success("Internal DB connected");
    } else {
      toast.error("Internal DB connection failed");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <Card className="w-full max-w-[400px]">
        <CardHeader>
          <CardTitle>n8n Workflow Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={handleProcessWorkflow} disabled={isProcessing} className="w-full">
            {isProcessing ? "Processing..." : "Run n8n Workflow"}
          </Button>
          <div className="space-y-1">
            <Label htmlFor="uid">User ID</Label>
            <Input id="uid" value={uid} onChange={(e) => setUid(e.target.value)} />
          </div>
          <Button onClick={handlePingDb} type="button" className="w-full">
            Ping Internal DB
          </Button>
          {dbPing && <div className="text-sm text-muted-foreground">Last ping: {dbPing}</div>}
          {lastUpdate && (
            <div className="text-sm text-muted-foreground">Last Update: {lastUpdate}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
