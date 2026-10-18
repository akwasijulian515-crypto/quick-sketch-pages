import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
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
  const { href: locationHref, pathname } = useRouterState({
    select: (state) => state.location,
  });
  const activeContext = useRef("");
  const brandingRef = useRef(defaultBranding);

  const updateTenantBranding = useCallback((nextBranding: TenantBranding) => {
    brandingRef.current = nextBranding;
    setBranding(nextBranding);
    for (const [property, value] of Object.entries(themeStyle(nextBranding.primaryColor))) {
      document.documentElement.style.setProperty(property, value);
    }
    document
      .querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]')
      .forEach((link) => {
        if (nextBranding.crestUrl) {
          link.href = nextBranding.crestUrl;
          link.removeAttribute("type");
          link.removeAttribute("sizes");
          return;
        }

        const isAppleTouchIcon = link.rel === "apple-touch-icon";
        link.href = isAppleTouchIcon ? "/brand/klasora-icon-192.png" : "/favicon-32.png";
        link.type = "image/png";
        link.sizes = isAppleTouchIcon ? "192x192" : "32x32";
      });
  }, []);

  useEffect(() => {
    const title =
      branding.schoolName === "Klasora"
        ? pathname === "/login"
          ? "Sign in — Klasora"
          : pathname === "/admin"
            ? "Super Admin — Klasora"
            : "Klasora | School operations"
        : `${branding.schoolName} | Klasora`;
    document.title = title;
  }, [branding.schoolName, pathname]);

  useEffect(() => {
    let cancelled = false;
    const isPlatformRoute = pathname === "/admin";
    const queryTenant = new URLSearchParams(window.location.search).get("tenant")?.trim() ?? "";
    const storedTenant = sessionStorage.getItem("hg-school")?.trim() ?? "";
    const selectedTenant = queryTenant || storedTenant;
    const context = isPlatformRoute ? "platform" : selectedTenant || window.location.host;

    if (activeContext.current !== context) {
      activeContext.current = context;
      const alreadyMatches = isPlatformRoute
        ? brandingRef.current.schoolName === defaultBranding.schoolName
        : selectedTenant
          ? brandingRef.current.subdomain === selectedTenant
          : false;
      if (!alreadyMatches) updateTenantBranding(defaultBranding);
    }
    if (isPlatformRoute) return;

    async function loadBranding() {
      try {
        const endpoint = selectedTenant
          ? `/api/school?tenant=${encodeURIComponent(selectedTenant)}`
          : "/api/school";
        const response = await fetch(endpoint);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          school?: (Partial<TenantBranding> & { name?: string }) | null;
        };
        const school = payload.school;
        if (cancelled || !school?.name || !school.subdomain) return;
        if (selectedTenant && school.subdomain !== selectedTenant) return;

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
  }, [locationHref, pathname, updateTenantBranding]);

  return (
    <TenantBrandingContext.Provider value={{ ...branding, updateTenantBranding }}>
      {children}
    </TenantBrandingContext.Provider>
  );
}
