import { aCent } from './dinero.js';
import { mesAnterior } from './reparto.js';

// Cambiar o quitar un gasto fijo no debe reescribir los meses ya pasados:
// el fijo antiguo se cierra en el mes anterior y el nuevo importe empieza este mes.

export function planCambiarFijo(fijo, cambios, mesActual) {
  const cambiaImporte = cambios.importe != null && aCent(cambios.importe) !== aCent(fijo.importe);
  if (!cambiaImporte || fijo.desde >= mesActual) {
    return [{ op: 'actualizar', id: fijo.id, cambios }];
  }
  return [
    { op: 'actualizar', id: fijo.id, cambios: { hasta: mesAnterior(mesActual) } },
    {
      op: 'insertar',
      fila: {
        ambito_id: fijo.ambito_id,
        nombre: cambios.nombre ?? fijo.nombre,
        importe: cambios.importe,
        dia: cambios.dia ?? fijo.dia,
        desde: mesActual,
        hasta: null,
      },
    },
  ];
}

export function planQuitarFijo(fijo, mesActual) {
  if (fijo.desde >= mesActual) return [{ op: 'borrar', id: fijo.id }];
  return [{ op: 'actualizar', id: fijo.id, cambios: { hasta: mesAnterior(mesActual) } }];
}

export async function aplicarPlan(datos, plan) {
  for (const paso of plan) {
    if (paso.op === 'actualizar') await datos.actualizarFijo(paso.id, paso.cambios);
    else if (paso.op === 'insertar') await datos.insertarFijo(paso.fila);
    else if (paso.op === 'borrar') await datos.borrarFijo(paso.id);
  }
}
