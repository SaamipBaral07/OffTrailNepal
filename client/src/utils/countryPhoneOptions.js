import { getCountries, getCountryCallingCode } from "libphonenumber-js";

const regionNameFormatter =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const toFlagEmoji = (iso2) => {
  if (!iso2 || String(iso2).length !== 2) {
    return "";
  }

  const upper = String(iso2).toUpperCase();
  const base = 127397;
  return String.fromCodePoint(...[...upper].map((char) => base + char.charCodeAt(0)));
};

const resolveCountryName = (iso2) => {
  if (!regionNameFormatter) {
    return iso2;
  }

  try {
    return regionNameFormatter.of(iso2) || iso2;
  } catch {
    return iso2;
  }
};

export const COUNTRY_PHONE_OPTIONS = getCountries()
  .map((iso2) => ({
    iso2,
    name: resolveCountryName(iso2),
    dialCode: `+${getCountryCallingCode(iso2)}`,
    flag: toFlagEmoji(iso2),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_COUNTRY_PHONE_OPTION =
  COUNTRY_PHONE_OPTIONS.find((item) => item.iso2 === "NP") || COUNTRY_PHONE_OPTIONS[0] || null;
