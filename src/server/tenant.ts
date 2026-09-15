export type TenantContext = {
  host: string;
  subdomain: string | null;
};

export function resolveTenant(request: Request, rootDomain?: string): TenantContext {
  const host = (request.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  const domain = rootDomain?.toLowerCase();

  if (!host || !domain || host === domain || host === `www.${domain}`) return { host, subdomain: null };
  const suffix = `.${domain}`;
  const candidate = host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
  return { host, subdomain: /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(candidate) ? candidate : null };
}
