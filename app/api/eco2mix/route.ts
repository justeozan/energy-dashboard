import { getEco2mix } from "@/lib/eco2mix";

export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  return Response.json(await getEco2mix());
}
