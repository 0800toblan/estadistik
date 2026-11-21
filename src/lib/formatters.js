// Utilidades puras de formato, fechas, strings y exportación CSV

export const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

export const apellidoDe = (nombre = "") => {
  const n = nombre.trim();
  if (n.includes(",")) return n.split(",")[0].trim();
  const partes = n.split(/\s+/);
  return partes[partes.length - 1] || "";
};

export const porApellido = (a, b) =>
  collator.compare(apellidoDe(a.nombre), apellidoDe(b.nombre)) ||
  collator.compare(a.nombre, b.nombre);

export const porNombre = (a, b) => collator.compare(a.nombre, b.nombre);

export const verNombre = (nombre = "") => {
  const n = nombre.trim();
  if (n.includes(",")) return n.replace(/\s*,\s*/, ", ");
  const partes = n.split(/\s+/);
  if (partes.length < 2) return n;
  return `${partes[partes.length - 1]}, ${partes.slice(0, -1).join(" ")}`;
};

export function fmtFecha(fecha) {
  if (!fecha) return "";
  const [y, m, d] = fecha.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtRelojNeto(totalSegundos) {
  const segs = Math.max(0, Math.floor(totalSegundos || 0));
  const mm = String(Math.floor(segs / 60)).padStart(2, "0");
  const ss = String(segs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function calcularSegundosActuales(match) {
  if (!match) return 0;
  const base = match.reloj_segundos || 0;
  if (!match.reloj_corriendo || !match.reloj_actualizado_en) return base;
  const diff = Math.floor((Date.now() - new Date(match.reloj_actualizado_en).getTime()) / 1000);
  return base + Math.max(0, diff);
}

export function sumarDiasISO(fechaISO, dias) {
  if (!fechaISO) return "";
  const [y, m, d] = fechaISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function sumarMinutosHora(horaStr, mins) {
  if (!horaStr) return "";
  const [hh, mm] = horaStr.split(":").map(Number);
  const total = (hh * 60 + mm + mins) % (24 * 60);
  const nh = String(Math.floor(total / 60)).padStart(2, "0");
  const nm = String(total % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

export function descargarCSV(nombreArchivo, filas) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const contenido = "\uFEFF" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
  const blob = new Blob([contenido], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
