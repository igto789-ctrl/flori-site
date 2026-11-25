import { describe, expect, it } from "vitest";
import { isOwner } from "./auth";

describe("isOwner", () => {
  it("пускает только пользователя с app_metadata.role = owner", () => {
    expect(isOwner({ app_metadata: { role: "owner" } })).toBe(true);
  });

  it("не пускает без пользователя, без роли и с другой ролью", () => {
    expect(isOwner(null)).toBe(false);
    expect(isOwner(undefined)).toBe(false);
    expect(isOwner({ app_metadata: {} })).toBe(false);
    expect(isOwner({ app_metadata: { role: "admin" } })).toBe(false);
  });

  it("не верит user_metadata — его пользователь может менять сам", () => {
    expect(isOwner({ app_metadata: {}, user_metadata: { role: "owner" } })).toBe(false);
  });
});
