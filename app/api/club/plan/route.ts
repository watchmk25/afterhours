import { handleClubRequest } from "@/lib/club-server";
export async function POST(request: Request) { return handleClubRequest(request, "plan"); }
