export type BirOfficeOption = {
  code: string;
  name: string;
  label: string;
};

export function formatBirOfficeLabel(code: string, name: string): string {
  const normalizedCode = code.trim().toUpperCase().replace(/^RDO[-\s]?([0-9]{1,3})([A-Z]+)?$/, (_, number: string, suffix = "") => `RDO ${number.padStart(3, "0")}${suffix}`);
  return name.trim() ? `${normalizedCode} - ${name.trim()}` : normalizedCode;
}

export function toBirOfficeOption(office: { official_code?: string; official_name?: string; code?: string; name?: string }): BirOfficeOption | null {
  const code = (office.official_code ?? office.code ?? "").trim();
  const name = (office.official_name ?? office.name ?? "").trim();
  return code ? { code, name, label: formatBirOfficeLabel(code, name) } : null;
}
