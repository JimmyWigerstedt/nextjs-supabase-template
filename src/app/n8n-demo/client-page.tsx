"use client";
import { useState } from "react";
import { clientApi } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { toast } from "sonner";

export function N8nDemoClient() {
  const [isProcessing, setIsProcessing] = useState(false);

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
          <Button onClick={handleProcessWorkflow} disabled={isProcessing} className="w-full">
            {isProcessing ? "Processing..." : "Run n8n Workflow"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
