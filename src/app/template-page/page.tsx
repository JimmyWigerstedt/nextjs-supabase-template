import { TemplatePageClient } from "./client-page";
import { AuthPageWrapper } from "./auth-wrapper";

export default function TemplatePage() {
  return (
    <AuthPageWrapper>
      <TemplatePageClient />
    </AuthPageWrapper>
  );
} 