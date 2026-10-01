import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import auth from "@/i18n/messages/auth";
import onboarding from "@/i18n/messages/onboarding";
import { publicContacts } from "@/lib/site";
import {
  initialOnboardingState,
  type OnboardingData,
  onboardingReducer,
  type OnboardingState,
  visibleErrors,
} from "./onboarding-state";
import { AgencyStep, ProfileStep, WorkStep } from "./onboarding-steps";
import { OnboardingSummary } from "./onboarding-summary";
import { OnboardingWizard } from "./onboarding-wizard";
import { PhoneLogin } from "./phone-login";
import { StepProgress } from "./step-progress";
import { TelegramLogin } from "./telegram-login";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element).replace(/[  ]/g, " ");

const noop = () => {};

function attempted(state: OnboardingState): OnboardingState {
  return onboardingReducer(state, { type: "next" });
}

describe("sign-in screen", () => {
  it("starts by detecting Telegram and offers the phone path with an honest SMS note", () => {
    for (const locale of ["ru", "uz"] as const) {
      const telegram = html(createElement(TelegramLogin, { locale }));
      expect(telegram).toContain(auth[locale].telegram.detecting);
      expect(telegram).toContain('role="status"');

      const phone = html(createElement(PhoneLogin, { locale }));
      expect(phone).toContain(auth[locale].phone.demoTitle);
      expect(phone).toContain(auth[locale].phone.demoText);
      expect(phone).toMatch(/<label[^>]*for="login-phone"/);
      expect(phone).toContain('type="tel"');
      expect(phone).toContain('aria-describedby="login-phone-message"');
      expect(phone).toContain(auth[locale].phone.getCode);
    }
  });
});

describe("onboarding wizard", () => {
  it("renders the language step first, marked as demo, with an accessible progress", () => {
    for (const locale of ["ru", "uz"] as const) {
      const markup = html(createElement(OnboardingWizard, { locale }));
      expect(markup).toContain(onboarding[locale].language.title);
      expect(markup).toContain(onboarding[locale].demo.text);
      expect(markup).toContain('aria-current="step"');
      expect(markup).toContain(`/${locale === "ru" ? "uz" : "ru"}/onboarding`);
      // The first step has no Back button.
      expect(markup).not.toContain(onboarding[locale].nav.back);
    }
  });

  it("counts five steps until «Индивидуальный риэлтор» removes the agency step", () => {
    const five = html(createElement(StepProgress, { locale: "ru", steps: ["language", "work", "profile", "agency", "done"], current: "work" }));
    expect(five).toContain("Шаг 2 из 5");
    const four = html(createElement(StepProgress, { locale: "ru", steps: ["language", "work", "profile", "done"], current: "profile" }));
    expect(four).toContain("Шаг 3 из 4");
    expect(four.match(/aria-current="step"/g)).toHaveLength(1);
  });

  it("links each step error to its control", () => {
    const work = attempted({ ...initialOnboardingState("ru"), step: "work" });
    const markup = html(
      createElement(WorkStep, { locale: "ru", state: work, errors: visibleErrors(work), dispatch: noop }),
    );
    expect(markup).toContain('id="onb-role-error"');
    expect(markup).toMatch(/id="onb-role-individual_realtor"[^>]*aria-describedby="[^"]*onb-role-error/);
    expect(markup).toContain(onboarding.ru.work.statusNote);
    expect(markup).toContain("Агент по недвижимости (самозанятый или ИП)");
    expect(markup).toContain("Пока не знаю");

    const profile = attempted({ ...initialOnboardingState("ru"), step: "profile" });
    const profileMarkup = html(
      createElement(ProfileStep, { locale: "ru", state: profile, errors: visibleErrors(profile), dispatch: noop }),
    );
    expect(profileMarkup).toMatch(/id="onb-name"[^>]*aria-invalid="true"/);
    expect(profileMarkup).toContain(onboarding.ru.profile.nameRequired);
    expect(profileMarkup).toContain(auth.ru.phone.required);
    expect(profileMarkup).toContain(onboarding.ru.profile.certificateTag);
    expect(profileMarkup).toContain("Чиланзар");
    // Optional fields never show an error on an empty submit.
    expect(profileMarkup).not.toContain('id="onb-telegram-error"');
  });

  it("shows the fictional agency for a demo invitation and the unknown registry note for a new one", () => {
    const base = initialOnboardingState("uz");
    const join: OnboardingState = { ...base, step: "agency", data: { ...base.data, role: "agency_agent", agencyMode: "join", inviteCode: "DEMO-2026" } };
    const joinMarkup = html(createElement(AgencyStep, { locale: "uz", state: join, errors: {}, dispatch: noop }));
    expect(joinMarkup).toContain("Demo Realty");
    expect(joinMarkup).toContain(onboarding.uz.agency.inviteFound);

    const create: OnboardingState = { ...base, step: "agency", data: { ...base.data, role: "agency_owner", agencyMode: "create" } };
    const createMarkup = html(createElement(AgencyStep, { locale: "uz", state: create, errors: {}, dispatch: noop }));
    expect(createMarkup).toContain(onboarding.uz.agency.registryNote);
    expect(createMarkup).not.toContain("Demo Realty");
  });
});

describe("onboarding summary", () => {
  const data: OnboardingData = {
    ...initialOnboardingState("ru").data,
    role: "agency_owner",
    legalStatus: "certified_realtor",
    name: "Азиз Рахимов",
    phone: "90 123 45 67",
    telegram: "t.me/aziz_realty",
    districts: ["yunusabad", "chilanzar"],
    propertyTypes: ["apartment"],
    certificate: "RC-0001",
    agencyMode: "create",
    agencyName: "Uy Realty",
  };

  it("marks self-declared facts as unverified and unchecked organization facts as unknown", () => {
    const markup = html(createElement(OnboardingSummary, { locale: "ru", data, headingRef: null, onEdit: noop }));
    expect(markup).toContain("+998 90 123 45 67");
    expect(markup).toContain("@aziz_realty");
    expect(markup).toContain("Чиланзар и Юнусабад");
    expect(markup).toContain("Сертифицированный риэлтор");
    expect(markup.match(/>Не проверено</g)?.length).toBe(4); // badges: status, phone, Telegram, certificate
    expect(markup).toContain("Единый реестр");
    expect(markup).toContain("Страхование ответственности");
    expect(markup.match(/Неизвестно/g)?.length).toBe(2);
    expect(markup).not.toMatch(/Подтвержд|Проверено/);
  });

  it("links the first steps into existing workspace routes and the workspace itself", () => {
    const markup = html(createElement(OnboardingSummary, { locale: "uz", data, headingRef: null, onEdit: noop }));
    for (const path of ["/uz/app/clients/new", "/uz/app/requirements/new", "/uz/app/properties/new", "/uz/app/radar/import"]) {
      expect(markup).toContain(`href="${path}"`);
    }
    expect(markup).toContain('href="/uz/app"');
    expect(markup).toContain(onboarding.uz.done.goToWorkspace);
  });

  it("says «Не указано» for skipped optional fields and hides the agency for individuals", () => {
    const individual: OnboardingData = { ...initialOnboardingState("ru").data, role: "individual_realtor", legalStatus: "unconfirmed", name: "Aziz", phone: "901234567" };
    const markup = html(createElement(OnboardingSummary, { locale: "ru", data: individual, headingRef: null, onEdit: noop }));
    expect(markup).toContain("Не указано");
    expect(markup).toContain("Статус не подтверждён");
    expect(markup).not.toContain(onboarding.ru.done.sections.agency);
    expect(markup).not.toContain(publicContacts.phoneDisplay);
  });
});
