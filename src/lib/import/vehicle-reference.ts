/**
 * Fitment reference data used by the title parser and the seed.
 * Aliases are upper-case tokens as they appear in eBay titles.
 * A model alias may also be a trim/chassis code (e.g. "328I", "F30", "W204"):
 * `trims` maps such aliases to a display trim name.
 */
export type ModelRef = {
  name: string;
  slug: string;
  aliases: string[];
  trims?: Record<string, string>;
};

export type MakeRef = {
  name: string;
  slug: string;
  aliases: string[];
  featured?: boolean;
  models: ModelRef[];
};

const m = (name: string, aliases: string[] = [], trims?: Record<string, string>): ModelRef => ({
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  aliases: [name.toUpperCase(), ...aliases],
  trims,
});

export const VEHICLE_REFERENCE: MakeRef[] = [
  {
    name: "Chevrolet",
    slug: "chevrolet",
    aliases: ["CHEVROLET", "CHEVY", "CHEV"],
    featured: true,
    models: [
      m("Malibu", ["MLIBU"]),
      m("Cruze"),
      m("Equinox"),
      m("Tahoe"),
      m("Impala"),
      m("Express", ["EXPRESS VAN"]),
      m("Silverado", ["SILVERADO 1500", "SILVERADO 2500"]),
      m("Spark"),
      m("Sonic"),
      m("Traverse"),
      m("Corvette"),
      m("Colorado"),
      m("Camaro"),
      m("Blazer"),
      m("Suburban"),
    ],
  },
  {
    name: "BMW",
    slug: "bmw",
    aliases: ["BMW"],
    featured: true,
    models: [
      m("3 Series", ["320I", "320", "325I", "328I", "328", "330I", "335I", "340I", "F30", "E90", "E92"], {
        "320I": "320i", "320": "320i", "325I": "325i", "328I": "328i", "328": "328i", "330I": "330i", "335I": "335i", "340I": "340i",
      }),
      m("4 Series", ["428I", "435I", "F32", "F36"], { "428I": "428i", "435I": "435i" }),
      m("2 Series", ["228I", "228", "230I", "M235I", "M240I", "F22"], {
        "228I": "228i", "228": "228i", "230I": "230i", "M235I": "M235i", "M240I": "M240i",
      }),
      m("5 Series", ["528I", "528XI", "528", "535I", "550I", "F10", "E60"], { "528I": "528i", "528XI": "528xi", "528": "528i", "535I": "535i", "550I": "550i" }),
      m("X1", ["E84", "F48"]),
      m("Z4", ["E85", "E89"]),
      m("X3", ["F25", "G01"]),
      m("X5", ["E70", "F15", "G05"]),
    ],
  },
  {
    name: "Mercedes-Benz",
    slug: "mercedes-benz",
    aliases: ["MERCEDES-BENZ", "MERCEDES BENZ", "MERCEDES", "BENZ", "MB"],
    featured: true,
    models: [
      m("C-Class", ["C-CLASS", "C CLASS", "C300", "C250", "C350", "C63", "W204", "W205"], {
        C300: "C300", C250: "C250", C350: "C350", C63: "C63 AMG",
      }),
      m("CLA-Class", ["CLA45", "CLA250", "CLA", "CLA-CLASS"], { CLA45: "CLA45 AMG", CLA250: "CLA250" }),
      m("M-Class", ["ML350", "ML550", "ML", "W164", "W166"], { ML350: "ML350", ML550: "ML550" }),
      m("E-Class", ["E-CLASS", "E350", "E550", "W212"], { E350: "E350", E550: "E550" }),
      m("S-Class", ["S-CLASS", "S550", "S500", "W221", "W222"], { S550: "S550", S500: "S500" }),
      m("SL-Class", ["SL", "SL500", "SL550", "R230"], { SL500: "SL500", SL550: "SL550" }),
      m("R-Class", ["R350", "W251"], { R350: "R350" }),
      m("G-Class", ["G-CLASS", "G550", "G63"]),
      m("CLK-Class", ["CLK", "CLK350", "CLK550", "W209"]),
    ],
  },
  {
    name: "Ford",
    slug: "ford",
    aliases: ["FORD"],
    featured: true,
    models: [
      m("Focus"), m("Explorer"), m("Mustang"), m("Expedition"), m("Flex"), m("Fusion"), m("Escape"), m("Edge"),
      m("F-150", ["F150", "F-150"]), m("F-250", ["F250", "F-250", "F250 SUPER DUTY"]),
      m("E-Series Van", ["VAN", "E250", "E350", "E-250", "E-350"], { E250: "E-250", E350: "E-350" }),
    ],
  },
  {
    name: "Dodge",
    slug: "dodge",
    aliases: ["DODGE"],
    featured: true,
    models: [
      m("Ram 1500", ["RAM 1500", "RAM1500", "RAM", "PICKUP 1500", "PICKUP"]),
      m("Ram 2500", ["RAM 2500", "RAM2500"]),
      m("Dart"), m("Grand Caravan", ["GRAND CARAVAN", "CARAVAN"]), m("Journey"), m("Charger"), m("Challenger"), m("Durango"),
      m("Avenger"),
    ],
  },
  {
    name: "Ram",
    slug: "ram",
    aliases: ["RAM"],
    models: [m("1500", ["RAM1500"]), m("2500", ["RAM2500"])],
  },
  {
    name: "Nissan",
    slug: "nissan",
    aliases: ["NISSAN"],
    featured: true,
    models: [m("Sentra"), m("Rogue"), m("Juke"), m("Altima"), m("Titan"), m("Versa"), m("350Z"), m("GT-R", ["GTR"]), m("Murano")],
  },
  {
    name: "Hyundai",
    slug: "hyundai",
    aliases: ["HYUNDAI"],
    featured: true,
    models: [
      m("Genesis Coupe", ["GENESIS COUPE"]), m("Elantra"), m("Santa Fe", ["SANTA FE", "SANTA"]), m("Genesis"), m("Equus"), m("Sonata"), m("Azera"), m("Accent"),
      m("Veloster"), m("Tucson"),
    ],
  },
  {
    name: "Buick",
    slug: "buick",
    aliases: ["BUICK"],
    models: [m("Encore"), m("LaCrosse", ["LACROSSE"]), m("Verano")],
  },
  {
    name: "Kia",
    slug: "kia",
    aliases: ["KIA"],
    featured: true,
    models: [m("Stinger"), m("Optima"), m("Soul"), m("Rio"), m("Sportage"), m("Telluride"), m("Sorento")],
  },
  {
    name: "Chrysler",
    slug: "chrysler",
    aliases: ["CHRYSLER"],
    models: [m("300", ["300C", "300S"], { "300C": "300C", "300S": "300S" }), m("200"), m("Town & Country", ["TOWN & COUNTRY", "TOWN AND COUNTRY", "TOWN"]), m("Pacifica")],
  },
  {
    name: "Volkswagen",
    slug: "volkswagen",
    aliases: ["VOLKSWAGEN", "VOLKS WAGEN", "VW"],
    models: [m("CC"), m("Passat"), m("Touareg"), m("Jetta")],
  },
  {
    name: "Audi",
    slug: "audi",
    aliases: ["AUDI"],
    featured: true,
    models: [m("A6"), m("A4"), m("A5"), m("Q5"), m("Q7")],
  },
  {
    name: "Maserati",
    slug: "maserati",
    aliases: ["MASERATI"],
    models: [m("Quattroporte", ["QUATTROPORTE", "QUATTROPORT"]), m("Ghibli")],
  },
  {
    name: "Infiniti",
    slug: "infiniti",
    aliases: ["INFINITI"],
    models: [m("EX35"), m("Q50"), m("G35"), m("QX80")],
  },
  {
    name: "Jeep",
    slug: "jeep",
    aliases: ["JEEP"],
    models: [m("Compass"), m("Grand Cherokee", ["GRAND CHEROKEE", "GRAND"]), m("Liberty"), m("Wrangler")],
  },
  {
    name: "Jaguar",
    slug: "jaguar",
    aliases: ["JAGUAR"],
    models: [m("XJ", ["XJ8", "XJL"]), m("XF")],
  },
  {
    name: "Lexus",
    slug: "lexus",
    aliases: ["LEXUS"],
    models: [
      m("IS", ["IS350", "IS250"], { IS350: "IS 350", IS250: "IS 250" }),
      m("ES", ["ES300", "ES350"], { ES300: "ES 300", ES350: "ES 350" }),
      m("GS", ["GS300", "GS350"], { GS300: "GS 300", GS350: "GS 350" }),
    ],
  },
  { name: "Mazda", slug: "mazda", aliases: ["MAZDA"], models: [m("CX-5", ["CX5"]), m("CX-9", ["CX9"]), m("CX-7", ["CX7"]), m("Mazda3", ["3"]), m("Mazda6", ["6"])] },
  { name: "Genesis", slug: "genesis", aliases: ["GENESIS"], models: [m("G70"), m("G80"), m("G90")] },
  { name: "Lincoln", slug: "lincoln", aliases: ["LINCOLN"], models: [m("MKZ"), m("Navigator")] },
  { name: "Volvo", slug: "volvo", aliases: ["VOLVO"], models: [m("S80", ["S 80", "80"])] },
  { name: "GMC", slug: "gmc", aliases: ["GMC"], models: [m("Yukon"), m("Acadia"), m("Sierra"), m("Terrain")] },
  { name: "Cadillac", slug: "cadillac", aliases: ["CADILLAC"], models: [m("CTS"), m("Escalade")] },
  { name: "Toyota", slug: "toyota", aliases: ["TOYOTA"], models: [m("Corolla"), m("Camry"), m("Sequoia"), m("Tundra"), m("FJ Cruiser", ["FJ CRUISER", "FJ"])] },
  { name: "Honda", slug: "honda", aliases: ["HONDA"], models: [m("Accord"), m("Civic"), m("CR-V", ["CRV"])] },
  { name: "Land Rover", slug: "land-rover", aliases: ["LAND ROVER", "LANDROVER"], models: [m("Range Rover Sport", ["RANGE ROVER SPORT"]), m("Range Rover", ["RANGE ROVER"])] },
  { name: "Fiat", slug: "fiat", aliases: ["FIAT"], models: [m("500")] },
  { name: "Scion", slug: "scion", aliases: ["SCION"], models: [m("tC", ["TC"])] },
  { name: "Subaru", slug: "subaru", aliases: ["SUBARU"], models: [m("Forester"), m("Legacy"), m("Impreza")] },
  { name: "Mini", slug: "mini", aliases: ["MINI"], models: [m("Cooper")] },
  { name: "Porsche", slug: "porsche", aliases: ["PORSCHE"], models: [m("Cayenne")] },
  { name: "Mercury", slug: "mercury", aliases: ["MERCURY"], models: [m("Mountaineer"), m("Milan"), m("Grand Marquis", ["GRAND MARQUIS"])] },
  { name: "Pontiac", slug: "pontiac", aliases: ["PONTIAC"], models: [m("Grand Prix", ["GRAND PRIX"])] },
  { name: "Saturn", slug: "saturn", aliases: ["SATURN"], models: [m("Vue")] },
  { name: "Bentley", slug: "bentley", aliases: ["BENTLEY"], models: [m("Continental", ["CONTINENTAL GT", "CONTINENTAL"])] },
  { name: "Can-Am", slug: "can-am", aliases: ["CAN AM", "CAN-AM", "CANAM"], models: [m("Maverick", ["MAVERICK XD", "MAVERICK"])] },
  { name: "Tesla", slug: "tesla", aliases: ["TESLA"], models: [m("Model S", ["MODEL S"])] },
];

/**
 * Model names that identify the make when a title omits it
 * (e.g. "18 19 20 21 STINGER Alternator 3.3l").
 */
export const MAKELESS_MODEL_HINTS: Record<string, { make: string; model: string }> = {
  STINGER: { make: "kia", model: "stinger" },
  RAM1500: { make: "ram", model: "1500" },
  "RANGE ROVER SPORT": { make: "land-rover", model: "range-rover-sport" },
  "RANGE ROVER": { make: "land-rover", model: "range-rover" },
  SILVERADO: { make: "chevrolet", model: "silverado" },
  TAHOE: { make: "chevrolet", model: "tahoe" },
  W251: { make: "mercedes-benz", model: "r-class" },
  R350: { make: "mercedes-benz", model: "r-class" },
  ML350: { make: "mercedes-benz", model: "m-class" },
  QUATTROPORTE: { make: "maserati", model: "quattroporte" },
  "GRAND PRIX": { make: "pontiac", model: "grand-prix" },
  JETTA: { make: "volkswagen", model: "jetta" },
  F30: { make: "bmw", model: "3-series" },
  "328I": { make: "bmw", model: "3-series" },
  F22: { make: "bmw", model: "2-series" },
  "428I": { make: "bmw", model: "4-series" },
  EXPEDITION: { make: "ford", model: "expedition" },
  EQUINOX: { make: "chevrolet", model: "equinox" },
  TERRAIN: { make: "gmc", model: "terrain" },
  MILAN: { make: "mercury", model: "milan" },
  IMPALA: { make: "chevrolet", model: "impala" },
  CRUZE: { make: "chevrolet", model: "cruze" },
  MALIBU: { make: "chevrolet", model: "malibu" },
  ROGUE: { make: "nissan", model: "rogue" },
  SENTRA: { make: "nissan", model: "sentra" },
  CHARGER: { make: "dodge", model: "charger" },
  FOCUS: { make: "ford", model: "focus" },
  "GENESIS COUPE": { make: "hyundai", model: "genesis-coupe" },
};
