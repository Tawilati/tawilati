import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/components/dashboard/api";
import { emailHint, roleLabel, staffApi, staffSentenceFor } from "@/components/dashboard/staff/staffApi";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("staff API calls", () => {
  it("lists staff from GET /api/staff", async () => {
    const member = { id: "1", name: "Rami", email: "rami@example.test", role: "WAITER", isActive: true, createdAt: "2026-10-28" };
    const fetchMock = stubFetch(200, { success: true, message: "staff list", data: [member] });
    await expect(staffApi.list()).resolves.toEqual([member]);
    expect(fetchMock).toHaveBeenCalledWith("/api/staff", expect.objectContaining({ method: "GET" }));
  });

  it("sends a new account as JSON and a change as PATCH /api/staff/:id", async () => {
    const fetchMock = stubFetch(201, { success: true, message: "staff created", data: { id: "1" } });
    await staffApi.add({ name: "Rami", email: "rami@example.test", password: "Secret123", role: "WAITER" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/staff");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, message: "staff updated", data: { id: "1" } })));
    await staffApi.update("1", { isActive: false });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/staff/1");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ isActive: false });
  });

  it("surfaces the contract code of a failure", async () => {
    stubFetch(409, { success: false, message: "email_already_in_use" });
    await expect(staffApi.add({ name: "A", email: "a@b.co", password: "Secret123", role: "KITCHEN" })).rejects.toMatchObject({
      code: "email_already_in_use",
      status: 409,
    });
  });
});

describe("staff wording", () => {
  it("turns codes into sentences and never shows the code", () => {
    const sentence = staffSentenceFor(new ApiError("email_already_in_use", 409));
    expect(sentence).toMatch(/already has an account/);
    expect(sentence).not.toMatch(/email_already_in_use/);
    expect(staffSentenceFor(new ApiError("weird", 500))).toMatch(/went wrong/);
  });

  it("labels roles", () => {
    expect(roleLabel("WAITER")).toBe("Waiter");
    expect(roleLabel("KITCHEN")).toBe("Kitchen");
  });

  it("hints only on an email that is filled in but invalid", () => {
    expect(emailHint("")).toBeUndefined();
    expect(emailHint(" rami@example.com ")).toBeUndefined();
    expect(emailHint("rami@")).toMatch(/valid email/);
  });
});
