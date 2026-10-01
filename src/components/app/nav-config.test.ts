import { describe, expect, it } from "vitest";
import shell from "@/i18n/messages/shell";
import { appRoutes, authHref } from "@/lib/routes";
import { activeSidebarKey, bottomNav, isActive, sidebarGroups, sidebarNav } from "./nav-config";

describe("workspace navigation", () => {
  it("links every sidebar entry to a named route, once", () => {
    const routes = new Set<string>(Object.values(appRoutes));
    for (const item of sidebarNav) expect(routes.has(item.href), item.key).toBe(true);
    expect(new Set(sidebarNav.map((item) => item.key)).size).toBe(sidebarNav.length);
    expect(new Set(sidebarNav.map((item) => item.href)).size).toBe(sidebarNav.length);
    for (const group of sidebarGroups) expect(group.items.length, group.key).toBeGreaterThan(0);
  });

  it("labels every group and entry in both languages", () => {
    for (const locale of ["ru", "uz"] as const) {
      for (const group of sidebarGroups) {
        expect(shell[locale].sidebarGroups[group.key].trim(), group.key).toBeTruthy();
        for (const item of group.items) expect(shell[locale].sidebar[item.key].trim(), item.key).toBeTruthy();
      }
    }
  });

  it("highlights the most specific sidebar entry", () => {
    const at = (path: string) => activeSidebarKey(`/ru/app${path}`, "ru");
    expect(at("")).toBe("today");
    expect(at("/mls")).toBe("mls");
    expect(at("/mls/cooperation/coop-01")).toBe("cooperation");
    expect(at("/team/routing")).toBe("team");
    expect(at("/verification/request")).toBe("verification");
    expect(at("/owners/new")).toBe("owners");
    expect(at("/requirements/req-01")).toBeUndefined();
  });

  it("keeps every sidebar destination under one bottom tab", () => {
    for (const item of sidebarNav) {
      const path = `/ru/app${item.href}`;
      const tabs = bottomNav.filter((tab) =>
        tab.match.some((prefix) => isActive(path, "ru", prefix, prefix === "")),
      );
      expect(tabs.map((tab) => tab.key), item.key).toHaveLength(1);
    }
  });

  it("builds sign-in links outside the workspace", () => {
    expect(authHref("uz", "login")).toBe("/uz/login");
    expect(authHref("ru", "onboarding")).toBe("/ru/onboarding");
  });
});
