import { integrationUnavailable } from "@/lib/integration-unavailable";

// Public callback must never write to a process-wide or guessed workspace.
export async function POST() { return integrationUnavailable("设备绑定确认"); }
