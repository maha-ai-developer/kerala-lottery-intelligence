/**
 * Kerala State Lottery Intelligence & Experiment Platform
 * Milestone 10A: Authoritative Kerala District Normalization Engine
 *
 * Grounding:
 * - 14 Official Revenue Districts of Kerala (Revenue Department, Government of Kerala)
 * - 35 Official District & Sub-Lottery Offices (Department of State Lotteries, Government of Kerala)
 *
 * Rules:
 * 1. Preserves raw source text exactly.
 * 2. Normalizes spelling/formatting deterministically.
 * 3. Maps towns/sub-lottery offices to parent districts only when grounded in administrative rule.
 * 4. Never guesses. Ambiguous or unrecognized locations remain UNKNOWN / AMBIGUOUS.
 */

import { DistrictNormalization, KeralaDistrict, KERALA_OFFICIAL_DISTRICTS } from "./geographic-types";

export interface LotteryOfficeAuthorityRecord {
  officeName: string;
  officeType: "DISTRICT_LOTTERY_OFFICE" | "SUB_LOTTERY_OFFICE";
  district: KeralaDistrict;
  talukOrTown: string;
  aliases: string[];
}

/**
 * Complete registry of all 35 official lottery offices established by the
 * Kerala State Lotteries Department across the 14 revenue districts.
 */
export const KERALA_LOTTERY_OFFICES: Record<string, LotteryOfficeAuthorityRecord> = {
  // 1. Thiruvananthapuram District
  THIRUVANANTHAPURAM: {
    officeName: "District Lottery Office, Thiruvananthapuram",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Thiruvananthapuram",
    talukOrTown: "Thiruvananthapuram",
    aliases: ["TRIVANDRUM", "TVM", "THIRUVANANTHAPURAM DLO"]
  },
  ATTINGAL: {
    officeName: "Sub Lottery Office, Attingal",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Thiruvananthapuram",
    talukOrTown: "Attingal / Chirayinkeezhu",
    aliases: ["ATTINGAL SLO"]
  },
  NEYYATTINKARA: {
    officeName: "Sub Lottery Office, Neyyattinkara",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Thiruvananthapuram",
    talukOrTown: "Neyyattinkara",
    aliases: ["NEYYATTINKARA SLO"]
  },

  // 2. Kollam District
  KOLLAM: {
    officeName: "District Lottery Office, Kollam",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Kollam",
    talukOrTown: "Kollam",
    aliases: ["QUILON", "KOLLAM DLO"]
  },
  KARUNAGAPALLY: {
    officeName: "Sub Lottery Office, Karunagapally",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kollam",
    talukOrTown: "Karunagappally",
    aliases: ["KARUNAGAPPALLY", "KARUNAGAPALLY SLO"]
  },
  PUNALUR: {
    officeName: "Sub Lottery Office, Punalur",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kollam",
    talukOrTown: "Punalur",
    aliases: ["PUNALUR SLO"]
  },

  // 3. Pathanamthitta District
  PATHANAMTHITTA: {
    officeName: "District Lottery Office, Pathanamthitta",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Pathanamthitta",
    talukOrTown: "Pathanamthitta",
    aliases: ["PATHANAMTHITTA DLO"]
  },
  ADOOR: {
    officeName: "Sub Lottery Office, Adoor",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Pathanamthitta",
    talukOrTown: "Adoor",
    aliases: ["ADOOR SLO"]
  },

  // 4. Alappuzha District
  ALAPPUZHA: {
    officeName: "District Lottery Office, Alappuzha",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Alappuzha",
    talukOrTown: "Alappuzha",
    aliases: ["ALLEPPEY", "ALAPPUZHA DLO"]
  },
  CHERTHALA: {
    officeName: "Sub Lottery Office, Cherthala",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Alappuzha",
    talukOrTown: "Cherthala",
    aliases: ["SHERTHALLAI", "CHERTHALA SLO"]
  },
  KAYAMKULAM: {
    officeName: "Sub Lottery Office, Kayamkulam",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Alappuzha",
    talukOrTown: "Kayamkulam",
    aliases: ["KAYAMKULAM SLO"]
  },

  // 5. Kottayam District
  KOTTAYAM: {
    officeName: "District Lottery Office, Kottayam",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Kottayam",
    talukOrTown: "Kottayam",
    aliases: ["KOTTAYAM DLO"]
  },
  VAIKKOM: {
    officeName: "Sub Lottery Office, Vaikom",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kottayam",
    talukOrTown: "Vaikom",
    aliases: ["VAIKOM", "VAIKKOM SLO"]
  },

  // 6. Idukki District
  IDUKKI: {
    officeName: "District Lottery Office, Idukki",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Idukki",
    talukOrTown: "Idukki / Painavu",
    aliases: ["IDUKKI DLO", "PAINAVU"]
  },
  ADIMALY: {
    officeName: "Sub Lottery Office, Adimaly",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Idukki",
    talukOrTown: "Adimali / Devikulam",
    aliases: ["ADIMALI", "ADIMALY SLO"]
  },
  KATTAPPANA: {
    officeName: "Sub Lottery Office, Kattappana",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Idukki",
    talukOrTown: "Kattappana",
    aliases: ["KATTAPPANA SLO"]
  },

  // 7. Ernakulam District
  ERNAKULAM: {
    officeName: "District Lottery Office, Ernakulam",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Ernakulam",
    talukOrTown: "Kochi / Kakkanad",
    aliases: ["COCHIN", "KOCHI", "ERNAKULAM DLO"]
  },
  MOOVATTUPUZHA: {
    officeName: "Sub Lottery Office, Muvattupuzha",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Ernakulam",
    talukOrTown: "Muvattupuzha",
    aliases: ["MUVATTUPUZHA", "MOOVATTUPUZHA SLO"]
  },

  // 8. Thrissur District
  THRISSUR: {
    officeName: "District Lottery Office, Thrissur",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Thrissur",
    talukOrTown: "Thrissur",
    aliases: ["TRICHUR", "THRISSUR DLO"]
  },
  GURUVAYOOR: {
    officeName: "Sub Lottery Office, Guruvayoor",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Thrissur",
    talukOrTown: "Chavakkad / Guruvayur",
    aliases: ["GURUVAYUR", "CHAVAKKAD", "GURUVAYOOR SLO"]
  },
  IRINJALAKUDA: {
    officeName: "Sub Lottery Office, Irinjalakuda",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Thrissur",
    talukOrTown: "Mukundapuram / Irinjalakuda",
    aliases: ["IRINJALAKUDA SLO"]
  },

  // 9. Palakkad District
  PALAKKAD: {
    officeName: "District Lottery Office, Palakkad",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Palakkad",
    talukOrTown: "Palakkad",
    aliases: ["PALGHAT", "PALAKKAD DLO"]
  },
  CHITTUR: {
    officeName: "Sub Lottery Office, Chittur",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Palakkad",
    talukOrTown: "Chittur",
    aliases: ["CHITTUR-THATHAMANGALAM", "CHITTUR SLO"]
  },
  PATTAMBI: {
    officeName: "Sub Lottery Office, Pattambi",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Palakkad",
    talukOrTown: "Pattambi",
    aliases: ["PATTAMBI SLO"]
  },

  // 10. Malappuram District
  MALAPPURAM: {
    officeName: "District Lottery Office, Malappuram",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Malappuram",
    talukOrTown: "Malappuram",
    aliases: ["MALAPPURAM DLO"]
  },
  THIRUR: {
    officeName: "Sub Lottery Office, Tirur",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Malappuram",
    talukOrTown: "Tirur",
    aliases: ["TIRUR", "THIRUR SLO"]
  },

  // 11. Kozhikode District
  KOZHIKKODE: {
    officeName: "District Lottery Office, Kozhikode",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Kozhikode",
    talukOrTown: "Kozhikode",
    aliases: ["KOZHIKODE", "CALICUT", "KOZHIKKODE DLO"]
  },
  THAMARASSERY: {
    officeName: "Sub Lottery Office, Thamarassery",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kozhikode",
    talukOrTown: "Thamarassery",
    aliases: ["THAMARASSERY SLO"]
  },
  VADAKARA: {
    officeName: "Sub Lottery Office, Vatakara",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kozhikode",
    talukOrTown: "Vatakara / Badagara",
    aliases: ["VATAKARA", "BADAGARA", "VADAKARA SLO"]
  },

  // 12. Wayanad District
  WAYANADU: {
    officeName: "District Lottery Office, Wayanad",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Wayanad",
    talukOrTown: "Kalpetta",
    aliases: ["WAYANAD", "KALPETTA", "WAYANADU DLO"]
  },
  MANANTHAVADY: {
    officeName: "Sub Lottery Office, Mananthavady",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Wayanad",
    talukOrTown: "Mananthavady",
    aliases: ["MANANTHAVADY SLO"]
  },

  // 13. Kannur District
  KANNUR: {
    officeName: "District Lottery Office, Kannur",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Kannur",
    talukOrTown: "Kannur",
    aliases: ["CANNANORE", "KANNUR DLO"]
  },
  PAYYANUR: {
    officeName: "Sub Lottery Office, Payyanur",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kannur",
    talukOrTown: "Payyanur",
    aliases: ["PAYYANUR SLO"]
  },

  // 14. Kasaragod District
  KASARAGOD: {
    officeName: "District Lottery Office, Kasaragod",
    officeType: "DISTRICT_LOTTERY_OFFICE",
    district: "Kasaragod",
    talukOrTown: "Kasaragod",
    aliases: ["KASARGOD", "KASARAGOD DLO"]
  },
  KANHANGAD: {
    officeName: "Sub Lottery Office, Kanhangad",
    officeType: "SUB_LOTTERY_OFFICE",
    district: "Kasaragod",
    talukOrTown: "Kanhangad / Hosdurg",
    aliases: ["KANGHANGAD", "HOSDURG", "KANHANGAD SLO"]
  }
};

export { KERALA_OFFICIAL_DISTRICTS } from "./geographic-types";

// Build index of normalized aliases to canonical office key
const ALIAS_INDEX = new Map<string, string>();

// First register sub-offices
for (const [key, record] of Object.entries(KERALA_LOTTERY_OFFICES)) {
  ALIAS_INDEX.set(key.toUpperCase(), key);
  ALIAS_INDEX.set(record.talukOrTown.toUpperCase(), key);
  for (const alias of record.aliases) {
    ALIAS_INDEX.set(alias.toUpperCase(), key);
  }
}

// Then register DLOs so district names always map to the DISTRICT_LOTTERY_OFFICE
for (const [key, record] of Object.entries(KERALA_LOTTERY_OFFICES)) {
  if (record.officeType === "DISTRICT_LOTTERY_OFFICE") {
    ALIAS_INDEX.set(record.district.toUpperCase(), key);
    ALIAS_INDEX.set(key.toUpperCase(), key);
  }
}

/**
 * Deterministically normalizes a raw location string to its canonical Kerala revenue district.
 *
 * Guarantees:
 * - Never guesses.
 * - Reversible to authoritative administrative rule.
 * - Returns "UNKNOWN" for unlisted locations.
 */
export function normalizeLocationToDistrict(rawLocation: string | null | undefined): DistrictNormalization {
  if (!rawLocation || typeof rawLocation !== "string" || !rawLocation.trim()) {
    return {
      rawLocation: rawLocation ?? "",
      normalizedLocation: "",
      normalizedDistrict: "UNKNOWN",
      officeType: "UNKNOWN",
      normalizationRule: "EMPTY_OR_NULL_LOCATION",
      normalizationSource: "KERALA_LOTTERIES_ADMINISTRATIVE_SETUP",
      confidence: 0.0
    };
  }

  const cleaned = rawLocation.trim().toUpperCase().replace(/[\(\)\[\]\{\}]/g, "").trim();

  // 1. Direct match on office key or alias
  const officeKey = ALIAS_INDEX.get(cleaned);
  if (officeKey && KERALA_LOTTERY_OFFICES[officeKey]) {
    const office = KERALA_LOTTERY_OFFICES[officeKey]!;
    const isDirectDistrictName = KERALA_OFFICIAL_DISTRICTS.map(d => d.toUpperCase()).includes(cleaned);

    return {
      rawLocation: rawLocation.trim(),
      normalizedLocation: officeKey,
      normalizedDistrict: office.district,
      officeType: office.officeType,
      normalizationRule: isDirectDistrictName
        ? "EXPLICIT_DISTRICT_MATCH"
        : "OFFICIAL_SUB_LOTTERY_OFFICE_TO_DISTRICT_MAP",
      normalizationSource: "KERALA_STATE_LOTTERIES_DLO_SLO_DIRECTORY",
      confidence: isDirectDistrictName ? 1.0 : 0.95
    };
  }

  // 2. Direct match on official 14 revenue district names
  for (const dist of KERALA_OFFICIAL_DISTRICTS) {
    if (dist.toUpperCase() === cleaned) {
      return {
        rawLocation: rawLocation.trim(),
        normalizedLocation: dist.toUpperCase(),
        normalizedDistrict: dist,
        officeType: "DISTRICT_LOTTERY_OFFICE",
        normalizationRule: "EXPLICIT_DISTRICT_MATCH",
        normalizationSource: "KERALA_REVENUE_DEPARTMENT_DISTRICT_GAZETTE",
        confidence: 1.0
      };
    }
  }

  // 3. Fallback for unrecognized location - strictly fail closed without guessing
  return {
    rawLocation: rawLocation.trim(),
    normalizedLocation: cleaned,
    normalizedDistrict: "UNKNOWN",
    officeType: "UNKNOWN",
    normalizationRule: "UNRECOGNIZED_LOCATION_FAIL_CLOSED",
    normalizationSource: "KERALA_STATE_LOTTERIES_ADMINISTRATIVE_DIRECTORY",
    confidence: 0.0
  };
}
