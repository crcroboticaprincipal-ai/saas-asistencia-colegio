import { esGradoValido, normalizarGrado, TODOS_LOS_GRADOS } from '../src/lib/grados-catalogo.ts';

console.log("Catálogo completo TODOS_LOS_GRADOS:");
console.log(TODOS_LOS_GRADOS);

const testCases = [
  'Inicial A',
  'Inicial B',
  'Inicial C',
  '1er Nivel Inicial',
  '2do Nivel Inicial',
  '3er Nivel Inicial',
  '1er Nivel',
  '2do Nivel',
  '3er Nivel',
  'Inicial',
  'INICIAL',
  'INICIAL A',
  '1ER NIVEL',
  '1er Grado',
  '1er Año',
  '5T',
  '1T',
];

console.log("\nPruebas de validación:");
for (const tc of testCases) {
  const valido = esGradoValido(tc);
  const norm = normalizarGrado(tc);
  console.log(`Input: "${tc}" -> Válido: ${valido} | Normalizado: "${norm}"`);
}
