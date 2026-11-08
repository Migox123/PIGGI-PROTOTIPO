/*
 * Piggi - Módulo de cálculo de horas extras
 * Reglas vigentes en Colombia a noviembre de 2026:
 *  - Jornada máxima de 42 horas semanales (Ley 2101 de 2021) -> divisor mensual 210 horas.
 *  - Jornada diurna 6:00 a. m. - 7:00 p. m.; nocturna 7:00 p. m. - 6:00 a. m. (Ley 2466 de 2025, art. 10).
 *  - Hora extra diurna +25 %, hora extra nocturna +75 % (CST art. 168).
 *  - Recargo dominical y festivo 90 % desde el 1 de julio de 2026 (Ley 2466 de 2025, art. 14).
 * Los porcentajes están en un objeto de configuración para poder actualizarlos
 * (por ejemplo, cuando el recargo dominical pase al 100 % en julio de 2027).
 */

const CONFIG_LEGAL = {
  horasSemanales: 42,
  divisorMensual: 210,          // (42 / 6) * 30
  inicioNocturno: 19,           // 7:00 p. m.
  finNocturno: 6,               // 6:00 a. m.
  recargos: {
    HED: 0.25,                  // Hora extra diurna
    HEN: 0.75,                  // Hora extra nocturna
    HEDDF: 0.25 + 0.90,         // Hora extra diurna dominical/festiva = 115 %
    HENDF: 0.75 + 0.90          // Hora extra nocturna dominical/festiva = 165 %
  },
  limiteDiarioHorasExtra: 2,
  limiteSemanalHorasExtra: 12
};

const NOMBRES_TIPO = {
  HED: 'Extra diurna',
  HEN: 'Extra nocturna',
  HEDDF: 'Extra diurna dominical/festiva',
  HENDF: 'Extra nocturna dominical/festiva'
};

// Festivos de Colombia 2026 (Ley 51 de 1983 - Ley Emiliani)
const FESTIVOS_2026 = [
  '2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03',
  '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15', '2026-06-29',
  '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02',
  '2026-11-16', '2026-12-08', '2026-12-25'
];

class CalculadoraHorasExtra {
  constructor(config = CONFIG_LEGAL, festivos = FESTIVOS_2026) {
    this.config = config;
    this.festivos = new Set(festivos);
  }

  valorHoraOrdinaria(salarioMensual) {
    return salarioMensual / this.config.divisorMensual;
  }

  static fechaISO(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  esDominicalOFestivo(d) {
    return d.getDay() === 0 || this.festivos.has(CalculadoraHorasExtra.fechaISO(d));
  }

  esNocturno(d) {
    const h = d.getHours();
    return h >= this.config.inicioNocturno || h < this.config.finNocturno;
  }

  /** Convierte fecha + horas (HH:MM) en un intervalo; si la hora fin es menor, pasa al día siguiente. */
  static intervalo(fecha, horaInicio, horaFin) {
    const [a, m, d] = fecha.split('-').map(Number);
    const [hi, mi] = horaInicio.split(':').map(Number);
    const [hf, mf] = horaFin.split(':').map(Number);
    const inicio = new Date(a, m - 1, d, hi, mi);
    let fin = new Date(a, m - 1, d, hf, mf);
    if (fin <= inicio) fin = new Date(fin.getTime() + 24 * 60 * 60 * 1000);
    return { inicio, fin };
  }

  /** Clasifica minuto a minuto el intervalo trabajado en los cuatro tipos de hora extra. */
  clasificar(fecha, horaInicio, horaFin) {
    const { inicio, fin } = CalculadoraHorasExtra.intervalo(fecha, horaInicio, horaFin);
    const minutos = { HED: 0, HEN: 0, HEDDF: 0, HENDF: 0 };
    for (let t = inicio.getTime(); t < fin.getTime(); t += 60000) {
      const momento = new Date(t);
      const nocturno = this.esNocturno(momento);
      const especial = this.esDominicalOFestivo(momento);
      const tipo = especial ? (nocturno ? 'HENDF' : 'HEDDF') : (nocturno ? 'HEN' : 'HED');
      minutos[tipo]++;
    }
    const horas = {};
    Object.keys(minutos).forEach(k => { horas[k] = minutos[k] / 60; });
    return horas;
  }

  /** Devuelve el detalle completo del cálculo para una solicitud. */
  calcular(salarioMensual, fecha, horaInicio, horaFin) {
    const valorHora = this.valorHoraOrdinaria(salarioMensual);
    const horas = this.clasificar(fecha, horaInicio, horaFin);
    const detalle = [];
    let total = 0;
    let totalHoras = 0;
    Object.keys(horas).forEach(tipo => {
      if (horas[tipo] > 0) {
        const factor = 1 + this.config.recargos[tipo];
        const valor = Math.round(horas[tipo] * valorHora * factor);
        detalle.push({ tipo, nombre: NOMBRES_TIPO[tipo], horas: horas[tipo], factor, valor });
        total += valor;
        totalHoras += horas[tipo];
      }
    });
    return { valorHora: Math.round(valorHora), totalHoras, detalle, total };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { CalculadoraHorasExtra, CONFIG_LEGAL, FESTIVOS_2026, NOMBRES_TIPO };
}
