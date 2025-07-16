import { serverApi } from "~/trpc/server";
import PrefetchClientPage from "~/app/prefetch/client-page";

export default async function Page() {
  const data = await serverApi.example.hello2();

  return <PrefetchClientPage data={data} />;
}
