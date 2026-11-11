import { useState } from 'preact/hooks';
import { euros } from './logica/dinero.js';
import { mesAnterior, mesSiguiente, movimientosDelMes } from './logica/reparto.js';
import { fechaCorta, nombreMes, nombreMesAnio, quedan } from './logica/texto.js';
import { Icono } from './piezas.jsx';

const pct = (parte, total) => (total > 0 ? Math.max(0, Math.min(100, (parte / total) * 100)) : 0);
// El gasto diario se enseña en euros enteros (hacia abajo); los céntimos solo si es menos de 10 €.
const alDia = (cent) => (cent >= 1000 ? Math.floor(cent / 100) * 100 : cent);

// ───────── ¿Cuánto puedo gastar?
export function Gastar({ r, onEntra, onGasto }) {
  return (
    <section class="vista">
      <p class="eyebrow">{nombreMes(r.mes)} · {quedan(r.diasRestantes)}</p>
      <h1 class="pregunta">¿Cuánto puedo gastar?</h1>

      {r.estado === 'vacio' && (
        <>
          <p class="cifra cifra--apagada">{euros(0)}</p>
          <p class="nota">Aún no ha entrado nada este mes.{r.fijosMes > 0 && ` Los fijos suman ${euros(r.fijosMes)}.`}</p>
        </>
      )}

      {r.estado === 'falta' && (
        <>
          <p class="cifra cifra--falta">−{euros(-r.disponible)}</p>
          <p class="nota nota--falta">No puedes gastar. Te faltan {euros(-r.disponible)}.</p>
          {r.colchon + r.ahorro > 0 && <p class="nota">Tienes {euros(r.colchon + r.ahorro)} guardados entre colchón y ahorro.</p>}
        </>
      )}

      {r.estado === 'ok' && (
        <>
          <p class="cifra">{euros(r.disponible)}</p>
          <p class="nota">{r.disponible > 0 ? `${euros(alDia(r.porDia))} al día` : 'Has gastado justo lo que tenías.'}</p>
        </>
      )}

      {r.paraGastar > 0 && (
        <div class="ritmo">
          <div class="ritmo__barra" role="img" aria-label={`Gastado ${euros(r.gastado)} de ${euros(r.paraGastar)}`}>
            <span class={`ritmo__lleno ${r.porEncimaDelRitmo ? 'ritmo__lleno--aviso' : ''}`} style={{ width: `${pct(r.gastado, r.paraGastar)}%` }} />
            <span class="ritmo__hoy" style={{ left: `${pct(r.dia, r.totalDias)}%` }} />
          </div>
          <div class="ritmo__pie">
            <span>Gastado {euros(r.gastado)} de {euros(r.paraGastar)}</span>
            {r.porEncimaDelRitmo && r.estado === 'ok' && <span class="ritmo__aviso">Por encima del ritmo</span>}
          </div>
        </div>
      )}

      <div class="acciones">
        <button type="button" class="btn btn--principal" onClick={onEntra}>+ Entra dinero</button>
        <button type="button" class="btn" onClick={onGasto}>− Gasto</button>
      </div>
    </section>
  );
}

// ───────── ¿Adónde va lo que entra?
export function Reparto({ r, ambito, onPagarImpuestos }) {
  const conImpuestos = Number(ambito.pct_impuestos) > 0 || r.impuestosApartados > 0 || r.impuestosMes > 0;
  const partes = [
    conImpuestos && { clave: 'impuestos', nombre: 'Impuestos', cent: r.impuestosMes },
    { clave: 'fijos', nombre: 'Fijos', cent: r.fijosMes },
    { clave: 'ahorro', nombre: 'Colchón y ahorro', cent: r.apartado },
    { clave: 'gastar', nombre: 'Para gastar', cent: r.paraGastar },
  ].filter(Boolean);

  return (
    <section class="vista">
      <p class="eyebrow">{nombreMes(r.mes)}</p>
      <h1 class="pregunta">¿Adónde va lo que entra?</h1>
      <p class="cifra cifra--media">{euros(r.entra)}</p>

      {r.entra > 0 && (
        <div class="tramos" aria-hidden="true">
          {partes.map((p) => p.cent > 0 && <span key={p.clave} class={`tramo tramo--${p.clave}`} style={{ width: `${pct(p.cent, r.entra)}%` }} />)}
        </div>
      )}

      <ul class="lista">
        {partes.map((p) => (
          <li key={p.clave} class="fila fila--plana">
            <span class={`punto punto--${p.clave}`} />
            <span class="fila__nombre">{p.nombre}</span>
            <span class={`fila__importe ${p.cent < 0 ? 'falta' : ''}`}>{p.cent < 0 ? `−${euros(-p.cent)}` : euros(p.cent)}</span>
          </li>
        ))}
      </ul>

      <h2 class="subtitulo">Apartado hasta hoy</h2>
      <div class="tarjetas">
        {conImpuestos && (
          <div class="tarjeta">
            <p class="eyebrow">Impuestos</p>
            <p class="tarjeta__cifra">{euros(r.impuestosApartados)}</p>
            <button type="button" class="btn btn--mini" onClick={onPagarImpuestos} disabled={r.impuestosApartados <= 0}>Apuntar pago</button>
          </div>
        )}
        <div class="tarjeta">
          <p class="eyebrow">Colchón</p>
          <p class="tarjeta__cifra">{euros(r.colchon)}</p>
          <div class="medidor"><span style={{ width: `${pct(r.colchon, r.colchonObjetivo)}%` }} /></div>
          <p class="tarjeta__pie">de {euros(r.colchonObjetivo)}</p>
        </div>
        <div class="tarjeta">
          <p class="eyebrow">Ahorro</p>
          <p class="tarjeta__cifra">{euros(r.ahorro)}</p>
          <p class="tarjeta__pie">{r.colchon < r.colchonObjetivo ? 'Empieza al llenar el colchón' : 'Con el colchón lleno'}</p>
        </div>
      </div>
      {conImpuestos && <p class="aclaracion">Los impuestos son una estimación. La cifra real, la de tu gestoría.</p>}
    </section>
  );
}

// ───────── ¿Qué se va solo cada mes?
export function Fijos({ r, onNuevo, onEditar }) {
  return (
    <section class="vista">
      <p class="eyebrow">cada mes</p>
      <h1 class="pregunta">¿Qué se va solo cada mes?</h1>
      <p class="cifra cifra--media">{euros(r.fijosMes)}</p>
      {r.fijosMes > 0 && <p class="nota">Ya han pasado {euros(r.fijosPasados)} · faltan {euros(r.fijosPendientes)}</p>}

      <ul class="lista">
        {r.fijos.map((f) => (
          <li key={f.id}>
            <button type="button" class="fila" onClick={() => onEditar(f)}>
              <span class={`marca-fijo ${f.pasado ? 'marca-fijo--pasado' : ''}`}>{f.pasado && <Icono n="hecho" tam={14} />}</span>
              <span class="fila__nombre">
                {f.nombre}
                <small>día {f.diaEfectivo}{f.pasado ? ' · ya restado' : ''}</small>
              </span>
              <span class="fila__importe">{euros(f.cent)}</span>
            </button>
          </li>
        ))}
      </ul>
      {r.fijos.length === 0 && <p class="vacio">Sin gastos fijos todavía.</p>}

      <div class="acciones">
        <button type="button" class="btn btn--principal" onClick={onNuevo}>+ Añadir fijo</button>
      </div>
    </section>
  );
}

// ───────── ¿Qué ha entrado y salido?
export function Movimientos({ info, mesHoy, onAbrir }) {
  const [mes, setMes] = useState(mesHoy);
  const filas = movimientosDelMes(info, mes);
  const entra = filas.filter((f) => f.clase === 'ingreso').reduce((s, f) => s + f.cent, 0);
  const sale = filas.filter((f) => f.clase === 'gasto').reduce((s, f) => s + f.cent, 0);

  return (
    <section class="vista">
      <div class="mes">
        <button type="button" class="redondo" onClick={() => setMes(mesAnterior(mes))} aria-label="Mes anterior"><Icono n="atras" tam={20} /></button>
        <p class="eyebrow">{nombreMesAnio(mes)}</p>
        <button type="button" class="redondo" onClick={() => setMes(mesSiguiente(mes))} disabled={mes >= mesHoy} aria-label="Mes siguiente"><Icono n="adelante" tam={20} /></button>
      </div>
      <h1 class="pregunta">¿Qué ha entrado y salido?</h1>

      <div class="par">
        <div><p class="eyebrow">Entra</p><p class="par__cifra entra">+{euros(entra)}</p></div>
        <div><p class="eyebrow">Sale</p><p class="par__cifra">−{euros(sale)}</p></div>
      </div>

      <ul class="lista">
        {filas.map((f) => (
          <li key={`${f.clase}-${f.id}`}>
            <button type="button" class="fila" onClick={() => onAbrir(f)}>
              <span class="fila__nombre">
                {f.concepto || (f.clase === 'ingreso' ? 'Ingreso' : f.tipo === 'impuestos' ? 'Pago de impuestos' : 'Gasto')}
                <small>{fechaCorta(f.fecha)}{f.tipo === 'impuestos' ? ' · impuestos' : ''}</small>
              </span>
              <span class={`fila__importe ${f.clase === 'ingreso' ? 'entra' : ''}`}>{f.clase === 'ingreso' ? '+' : '−'}{euros(f.cent)}</span>
            </button>
          </li>
        ))}
      </ul>
      {filas.length === 0 && <p class="vacio">Nada apuntado este mes.</p>}
      <p class="aclaracion">Los gastos fijos no aparecen aquí: se restan solos.</p>
    </section>
  );
}
