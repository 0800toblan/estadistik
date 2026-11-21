// Constantes y tokens globales de la aplicación

export const ADMIN_EMAIL = "toblanqui@outlook.com";
export const isSuperAdmin = (email) => (email || "").trim().toLowerCase() === ADMIN_EMAIL;

export const STAT_FIELDS = [
  { key: "puntos", label: "Puntos", short: "Pts" },
  { key: "tiros", label: "Tiros", short: "Tiros" },
  { key: "asistencias", label: "Asistencias", short: "Asist" },
  { key: "rebotes", label: "Rebotes", short: "Reb" },
  { key: "robos", label: "Robos", short: "Rob" },
  { key: "perdidas", label: "Pérdidas", short: "Pérd" },
];

export const SEXO = {
  varon: { sim: "♂", nombre: "Varón", color: "#38BDF8" },
  mujer: { sim: "♀", nombre: "Mujer", color: "#F472B6" },
};

export const EN_CANCHA = 8;
export const POR_ZONA = 4;
export const POR_SEXO = 2;
export const MAX_CAMBIOS = 8;

export const EXTRA_FIELDS = ["free_pass", "penales", "amarillas", "rojas"];

export const TEAM_SEED = [
  "La Patriada A", "La Patriada B", "Escorpiones",
  "Fosforitos", "Uruguay Korf", "CEF 102",
];

export const SAVE_DELAY = 900;

// Paleta 60-30-10 (Estilo Suizo Oscuro + Flúor)
export const INK = "#0B0C0E";
export const SURFACE = "#111317";
export const ELEVATED = "#16191F";
export const LINE = "#24272E";
export const CLUB = "#1E40AF";
export const FLUOR = "#CCFF00";
export const GOLD = "#E3A63E";
export const TEXT = "#F4F4F6";
export const MUTED = "#8E939E";
export const FAINT = "#5C6270";
export const RED = "#FF4D4D";
export const ORANGE = "#FF7A00";

export const COLOR_A = { ring: "#2DD4BF", bg: "#0D2927", text: "#5EEAD4", bar: "#14B8A6" };
export const COLOR_B = { ring: "#F97316", bg: "#2E170B", text: "#FDBA74", bar: "#EA580C" };

export const ACCIONES = [
  { id: "gol", label: "Gol", field: "puntos", val: (x) => x.puntos, tono: "gol" },
  { id: "fallo", label: "Fallo", field: "tiros", val: (x) => x.tiros - x.puntos },
  { id: "asist", label: "Asist.", field: "asistencias", val: (x) => x.asistencias },
  { id: "reb", label: "Reb.", field: "rebotes", val: (x) => x.rebotes },
  { id: "robo", label: "Robo", field: "robos", val: (x) => x.robos },
  { id: "perd", label: "Pérd.", field: "perdidas", val: (x) => x.perdidas },
  { id: "fp", label: "Free pass", field: "free_pass", val: (x) => x.free_pass, tono: "falta" },
  { id: "pen", label: "Penal", field: "penales", val: (x) => x.penales, tono: "falta" },
  { id: "am", label: "Amarilla", field: "amarillas", val: (x) => x.amarillas, tono: "amarilla" },
  { id: "ro", label: "Roja", field: "rojas", val: (x) => x.rojas, tono: "roja" },
];
