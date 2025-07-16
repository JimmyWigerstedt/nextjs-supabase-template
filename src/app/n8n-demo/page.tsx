import { N8nDemoClient } from "~/app/n8n-demo/client-page";
import { AuthPageWrapper } from "~/app/n8n-demo/auth-wrapper";

export default async function N8nDemoPage() {
  return (
    <AuthPageWrapper>
      <N8nDemoClient />
    </AuthPageWrapper>
  );
}
