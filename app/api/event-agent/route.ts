import { handleEventRequest } from "../../../lib/event-server.ts";

export async function POST(request: Request) {
  return handleEventRequest(request);
}
