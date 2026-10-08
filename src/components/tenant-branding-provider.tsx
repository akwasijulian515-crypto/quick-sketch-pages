import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";

export type TenantBranding = {
  schoolName: string;
  subdomain: string;
  primaryColor: string;
  crestUrl: string | null;
};

const defaultBranding: TenantBranding = {
  schoolName: "Klasora",
  subdomain: "school",
  primaryColor: "#1f5c3b",
  crestUrl: null,
};

type TenantBrandingContextValue = TenantBranding & {
  updateTenantBranding: (branding: TenantBranding) => void;
};

const TenantBrandingContext = createContext<TenantBrandingContextValue>({
  ...defaultBranding,
  updateTenantBranding: () => {},
});

type TenantThemeStyle = CSSProperties & Record<`--${string}`, string>;

function foregroundFor(color: string) {
  const channels = color
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [0, 0, 0];
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.42 ? "#183237" : "#ffffff";
}

function themeStyle(color: string): TenantThemeStyle {
  const foreground = foregroundFor(color);
  const tint = (amount: number) => `color-mix(in oklab, ${color} ${amount}%, white)`;

  return {
    "--primary": color,
    // Always-dark version of the tenant colour so glossy surfaces stay legible for any choice.
    "--brand-deep": `oklch(from ${color} min(l, 0.32) min(c, 0.16) h)`,
    "--primary-foreground": foreground,
    "--secondary": tint(12),
    "--secondary-foreground": color,
    "--accent": tint(10),
    "--accent-foreground": color,
    "--ring": color,
    "--border": `color-mix(in oklab, ${color} 14%, transparent)`,
    "--input": `color-mix(in oklab, ${color} 20%, transparent)`,
    "--sidebar-primary": color,
    "--sidebar-primary-foreground": foreground,
    "--sidebar-accent": `color-mix(in oklab, ${color} 82%, black)`,
    "--sidebar-accent-foreground": "#ffffff",
    "--sidebar-border": `color-mix(in oklab, ${color} 28%, transparent)`,
    "--sidebar-ring": color,
  } as TenantThemeStyle;
}

export function useTenantBranding() {
  return useContext(TenantBrandingContext);
}

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState(defaultBranding);
  const locationHref = useRouterState({ select: (state) => state.location.href });

  const updateTenantBranding = useCallback((nextBranding: TenantBranding) => {
    setBranding(nextBranding);
    for (const [property, value] of Object.entries(themeStyle(nextBranding.primaryColor))) {
      document.documentElement.style.setProperty(property, value);
    }
    document.title = `${nextBranding.schoolName} | Klasora`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const previewTenant =
      new URLSearchParams(window.location.search).get("tenant") ??
      sessionStorage.getItem("hg-school");
    const endpoint = previewTenant
      ? `/api/school?tenant=${encodeURIComponent(previewTenant)}`
      : "/api/school";

    async function loadBranding() {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          school?: (Partial<TenantBranding> & { name?: string }) | null;
        };
        const school = payload.school;
        if (cancelled || !school?.name || !school.subdomain) return;

        const primaryColor =
          typeof school.primaryColor === "string" && /^#[0-9a-f]{6}$/i.test(school.primaryColor)
            ? school.primaryColor
            : defaultBranding.primaryColor;
        const nextBranding = {
          schoolName: school.name,
          subdomain: school.subdomain,
          primaryColor,
          crestUrl: school.crestUrl ?? null,
        };

        updateTenantBranding(nextBranding);
      } catch {
        // Keep the platform defaults when no tenant is available.
      }
    }

    void loadBranding();
    return () => {
      cancelled = true;
    };
  }, [locationHref, updateTenantBranding]);

  return (
    <TenantBrandingContext.Provider value={{ ...branding, updateTenantBranding }}>
      {children}
    </TenantBrandingContext.Provider>
  );
}
