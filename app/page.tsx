import Dashboard from "@/components/Dashboard";
import { getEco2mix } from "@/lib/eco2mix";

// Régénérée au plus toutes les 5 minutes (ISR) ; le client se rafraîchit ensuite seul.
export const revalidate = 300;

export default async function Page() {
  const data = await getEco2mix();
  return <Dashboard initial={data} />;
}
