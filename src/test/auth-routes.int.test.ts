import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as checkName } from "@/app/api/auth/business-name/route";

// Emails and business names are unique, so each run uses its own.
const run = randomBytes(3).toString("hex");
const owner = {
  businessName: `Auth Test Café ${run}`,
  ownerName: "Ali",
  email: `owner-${run}@tawilati.test`,
  password: "Secret123",
};
const businessIds: string[] = [];

function post(handler: (req: NextRequest) => Promise<Response>, path: string, body: unknown) {
  return handler(
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const cookieNames = (res: Response) => res.headers.getSetCookie().map((c) => c.split("=")[0]).sort();

afterAll(async () => {
  // Users cascade with their business.
  await prisma.business.deleteMany({ where: { id: { in: businessIds } } });
  await prisma.$disconnect();
});

describe("POST /api/auth/register", () => {
  it("creates the business and its owner, and signs the owner in", async () => {
    const res = await post(register, "/api/auth/register", owner);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data).toMatchObject({ role: "OWNER", slug: `auth-test-cafe-${run}` });
    businessIds.push(body.data.businessId);
    expect(cookieNames(res)).toEqual(["auth_token", "refresh_token"]);
  });

  it("rejects an email that is already used, whatever its case", async () => {
    const res = await post(register, "/api/auth/register", {
      ...owner,
      businessName: `Other Café ${run}`,
      email: owner.email.toUpperCase(),
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, message: "email_already_in_use" });
  });

  it("rejects a business name that is already taken", async () => {
    const res = await post(register, "/api/auth/register", {
      ...owner,
      email: `second-${run}@tawilati.test`,
    });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ success: false, message: "business_name_taken" });
  });

  it("returns validation_error with the messages keyed by field", async () => {
    const res = await post(register, "/api/auth/register", {
      businessName: "",
      ownerName: "Ali",
      email: "not-an-email",
      password: "123",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, message: "validation_error" });
    expect(Object.keys(body.details).sort()).toEqual(["businessName", "email", "password"]);
  });
});

describe("GET /api/auth/business-name", () => {
  const check = (name: string) =>
    checkName(new NextRequest(`http://localhost/api/auth/business-name?name=${encodeURIComponent(name)}`));

  it("says a registered name is taken and a new one is free", async () => {
    const taken = await check(owner.businessName);
    const free = await check(`Never Registered ${run}`);

    expect(await taken.json()).toEqual({ success: true, data: { available: false } });
    expect(await free.json()).toEqual({ success: true, data: { available: true } });
  });

  it("rejects a name that breaks the rules", async () => {
    const res = await check("1");

    expect(res.status).toBe(400);
    expect(Object.keys((await res.json()).details)).toEqual(["name"]);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with the email in any case and sets both cookies", async () => {
    const res = await post(login, "/api/auth/login", {
      email: `  ${owner.email.toUpperCase()}  `,
      password: owner.password,
    });

    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ email: owner.email, role: "OWNER" });
    expect(cookieNames(res)).toEqual(["auth_token", "refresh_token"]);
  });

  it("gives the same 401 for a wrong password, an unknown email and a deactivated account", async () => {
    const wrongPassword = await post(login, "/api/auth/login", { email: owner.email, password: "Wrong12345" });
    const unknownEmail = await post(login, "/api/auth/login", {
      email: `nobody-${run}@tawilati.test`,
      password: owner.password,
    });
    await prisma.user.update({ where: { email: owner.email }, data: { isActive: false } });
    const deactivated = await post(login, "/api/auth/login", { email: owner.email, password: owner.password });

    for (const res of [wrongPassword, unknownEmail, deactivated]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ success: false, message: "invalid_credentials" });
      expect(res.headers.getSetCookie()).toEqual([]);
    }
  });
});
