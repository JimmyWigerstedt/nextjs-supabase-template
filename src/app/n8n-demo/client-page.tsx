"use client";
import { useState, useEffect } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

export function N8nDemoClient() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [form, setForm] = useState({ test1: "", test2: "" });

  const { data, refetch } = clientApi.internal.getUserData.useQuery();

  const { mutate: updateData, isLoading: updating } =
    clientApi.internal.updateUserData.useMutation({
      onSuccess: () => {
        toast.success("Data updated");
        void refetch();
      },
      onError: (err) => toast.error(err.message),
    });

  const { mutate: initData } = clientApi.internal.initializeUserData.useMutation({
    onSuccess: () => {
      toast.success("Initialized user data");
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    const es = new EventSource("/api/stream/user-updates");
    es.onmessage = () => {
      void refetch();
    };
    return () => es.close();
  }, [refetch]);

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <Card className="max-w-[400px]">
        <CardHeader>
          <CardTitle>n8n Workflow Demo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-2">
            <Input
              placeholder="test1"
              value={form.test1}
              onChange={(e) => setForm({ ...form, test1: e.target.value })}
            />
            <Input
              placeholder="test2"
              value={form.test2}
              onChange={(e) => setForm({ ...form, test2: e.target.value })}
            />
            <Button
              onClick={() => updateData(form)}
              disabled={updating}
            >
              {updating ? "Saving..." : "Save"}
            </Button>
            <Button onClick={() => initData()} variant="secondary">
              Initialize
            </Button>
          </div>
          <Button onClick={handleProcessWorkflow} disabled={isProcessing} className="w-full mt-2">
            {isProcessing ? "Processing..." : "Run n8n Workflow"}
          </Button>
          {data && (
            <pre className="mt-4 text-sm">{JSON.stringify(data, null, 2)}</pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
