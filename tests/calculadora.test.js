// Pruebas del módulo de cálculo. Ejecutar con: node tests/calculadora.test.js
const assert = require('assert');
const { CalculadoraHorasExtra } = require('../js/calculadora.js');

const calc = new CalculadoraHorasExtra();
const SALARIO = 2100000; // valor hora ordinaria = 2.100.000 / 210 = 10.000

const casos = [
  { id: 'CP-01', desc: 'Martes 5:00 p. m. a 7:00 p. m. (2 h extra diurnas)', fecha: '2026-11-03', ini: '17:00', fin: '19:00', esperado: 25000 },
  { id: 'CP-02', desc: 'Miércoles 7:00 p. m. a 9:00 p. m. (2 h extra nocturnas)', fecha: '2026-11-04', ini: '19:00', fin: '21:00', esperado: 35000 },
  { id: 'CP-03', desc: 'Jueves 6:00 p. m. a 8:00 p. m. (1 h diurna + 1 h nocturna)', fecha: '2026-11-05', ini: '18:00', fin: '20:00', esperado: 30000 },
  { id: 'CP-04', desc: 'Domingo 8:00 a. m. a 10:00 a. m. (2 h extra diurnas dominicales)', fecha: '2026-11-08', ini: '08:00', fin: '10:00', esperado: 43000 },
  { id: 'CP-05', desc: 'Domingo 10:00 p. m. a 12:00 a. m. (2 h extra nocturnas dominicales)', fecha: '2026-11-08', ini: '22:00', fin: '00:00', esperado: 53000 },
  { id: 'CP-06', desc: 'Festivo lunes 16 de noviembre 3:00 p. m. a 5:00 p. m.', fecha: '2026-11-16', ini: '15:00', fin: '17:00', esperado: 43000 },
  { id: 'CP-07', desc: 'Sábado 11:00 p. m. a domingo 1:00 a. m. (cruza a domingo)', fecha: '2026-11-07', ini: '23:00', fin: '01:00', esperado: 17500 + 26500 },
  { id: 'CP-08', desc: 'Viernes 5:30 p. m. a 6:15 p. m. (45 minutos diurnos)', fecha: '2026-11-06', ini: '17:30', fin: '18:15', esperado: 9375 }
];

let ok = 0;
for (const c of casos) {
  const r = calc.calcular(SALARIO, c.fecha, c.ini, c.fin);
  try {
    assert.strictEqual(r.total, c.esperado);
    ok++;
    console.log(`✔ ${c.id} ${c.desc} -> $${r.total.toLocaleString('es-CO')}`);
  } catch (e) {
    console.log(`✘ ${c.id} ${c.desc} -> obtenido $${r.total}, esperado $${c.esperado}`);
  }
}
console.log(`\n${ok}/${casos.length} casos de prueba aprobados`);
process.exit(ok === casos.length ? 0 : 1);
