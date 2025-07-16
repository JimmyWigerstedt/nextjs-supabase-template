import { TemplatePageClient } from "~/app/template-page/client-page";
import { AuthPageWrapper } from "~/app/template-page/auth-wrapper";

export default function TemplatePage() {
  return (
    <AuthPageWrapper>
      <TemplatePageClient />
    </AuthPageWrapper>
  );
} 