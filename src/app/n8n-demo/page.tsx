import { N8nDemoClient } from "./client-page";
import { AuthPageWrapper } from "./auth-wrapper";

export default async function N8nDemoPage() {
  return (
    <AuthPageWrapper>
      <N8nDemoClient />
    </AuthPageWrapper>
  );
}
