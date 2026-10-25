import { handleQlooRequest } from "../../../../lib/qloo-server.ts";

export async function POST(request: Request) {
  return handleQlooRequest(request, "search");
}
