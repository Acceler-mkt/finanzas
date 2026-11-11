import { useEffect, useRef, useState } from 'preact/hooks';
import { aEuros, euros, leerImporte } from './logica/dinero.js';
import { fechaCorta } from './logica/texto.js';
import { Hoja, Interruptor } from './piezas.jsx';

function CampoImporte({ valor, onCambio, enfocar = true }) {
  const ref = useRef(null);
  useEffect(() => { if (enfocar) ref.current?.focus(); }, [enfocar]);
  return (
    <label class="importe">
      <span class="oculto">Importe en euros</span>
      <input ref={ref} type="text" inputMode="decimal" autoComplete="off" placeholder="0" value={valor} onInput={(e) => onCambio(e.currentTarget.value)} />
      <span class="importe__euro" aria-hidden="true">€</span>
    </label>
  );
}

function Campo({ etiqueta, children }) {
  return (
    <label class="campo">
      <span class="eyebrow">{etiqueta}</span>
      {children}
    </label>
  );
}

// ───────── Entra dinero
export function HojaIngreso({ ambito, hoy, ocupado, onGuardar, onCerrar }) {
  const pct = Number(ambito.pct_impuestos);
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [apartar, setApartar] = useState(pct > 0);

  const cent = leerImporte(importe);
  const impuestos = cent && apartar ? Math.round((cent * pct) / 100) : 0;

  const enviar = (e) => {
    e.preventDefault();
    if (!cent) return;
    onGuardar({ ambito_id: ambito.id, fecha, importe: aEuros(cent), impuestos: aEuros(impuestos), concepto: concepto.trim() });
  };

  return (
    <Hoja titulo="Entra dinero" onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <CampoImporte valor={importe} onCambio={setImporte} />
        {pct > 0 && (
          <Interruptor activo={apartar} onCambio={setApartar} dato={cent && apartar ? euros(impuestos) : null}>
            Apartar el {pct} % para impuestos
          </Interruptor>
        )}
        <Campo etiqueta="Concepto (opcional)">
          <input type="text" value={concepto} maxLength={80} onInput={(e) => setConcepto(e.currentTarget.value)} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={fecha} max={hoy} required onInput={(e) => setFecha(e.currentTarget.value || hoy)} />
        </Campo>
        <button type="submit" class="btn btn--principal btn--ancho" disabled={!cent || ocupado}>Guardar</button>
      </form>
    </Hoja>
  );
}

// ───────── Gasto (o pago de impuestos, que sale de lo apartado)
export function HojaGasto({ ambito, hoy, r, esImpuestos = false, ocupado, onGuardar, onCerrar }) {
  const puedeSerImpuestos = Number(ambito.pct_impuestos) > 0 || r.impuestosApartados > 0;
  const [importe, setImporte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState(hoy);
  const [impuestos, setImpuestos] = useState(esImpuestos);

  const cent = leerImporte(importe);

  const enviar = (e) => {
    e.preventDefault();
    if (!cent) return;
    onGuardar({ ambito_id: ambito.id, fecha, importe: aEuros(cent), tipo: impuestos ? 'impuestos' : 'normal', concepto: concepto.trim() });
  };

  return (
    <Hoja titulo={impuestos ? 'Pago de impuestos' : 'Gasto'} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <CampoImporte valor={importe} onCambio={setImporte} />
        {puedeSerImpuestos && (
          <Interruptor activo={impuestos} onCambio={setImpuestos} dato={impuestos ? `de ${euros(r.impuestosApartados)}` : null}>
            Es un pago de impuestos
          </Interruptor>
        )}
        <Campo etiqueta="Concepto (opcional)">
          <input type="text" value={concepto} maxLength={80} onInput={(e) => setConcepto(e.currentTarget.value)} />
        </Campo>
        <Campo etiqueta="Fecha">
          <input type="date" value={fecha} max={hoy} required onInput={(e) => setFecha(e.currentTarget.value || hoy)} />
        </Campo>
        <button type="submit" class="btn btn--principal btn--ancho" disabled={!cent || ocupado}>Guardar</button>
      </form>
    </Hoja>
  );
}

// ───────── Gasto fijo (nuevo o existente)
export function HojaFijo({ fijo, ocupado, onGuardar, onQuitar, onCerrar }) {
  const [nombre, setNombre] = useState(fijo?.nombre ?? '');
  const [importe, setImporte] = useState(fijo ? String(fijo.importe).replace('.', ',') : '');
  const [dia, setDia] = useState(String(fijo?.dia ?? 1));

  const cent = leerImporte(importe);
  const nDia = Number(dia);
  const valido = cent && nombre.trim() && Number.isInteger(nDia) && nDia >= 1 && nDia <= 31;

  const enviar = (e) => {
    e.preventDefault();
    if (!valido) return;
    onGuardar({ nombre: nombre.trim(), importe: aEuros(cent), dia: nDia });
  };

  return (
    <Hoja titulo={fijo ? 'Gasto fijo' : 'Nuevo gasto fijo'} onCerrar={onCerrar}>
      <form onSubmit={enviar}>
        <CampoImporte valor={importe} onCambio={setImporte} enfocar={!fijo} />
        <Campo etiqueta="Nombre">
          <input type="text" value={nombre} maxLength={60} required placeholder="Alquiler, gestoría, móvil…" onInput={(e) => setNombre(e.currentTarget.value)} />
        </Campo>
        <Campo etiqueta="Día del mes en que se cobra">
          <input type="number" inputMode="numeric" min="1" max="31" step="1" required value={dia} onInput={(e) => setDia(e.currentTarget.value)} />
        </Campo>
        <p class="aclaracion">Se resta solo cada mes. Si cambias el importe, vale desde este mes.</p>
        <button type="submit" class="btn btn--principal btn--ancho" disabled={!valido || ocupado}>Guardar</button>
        {fijo && <button type="button" class="btn btn--peligro btn--ancho" disabled={ocupado} onClick={onQuitar}>Quitar desde este mes</button>}
      </form>
    </Hoja>
  );
}

// ───────── Un movimiento ya apuntado
export function HojaMovimiento({ mov, ocupado, onBorrar, onCerrar }) {
  const esIngreso = mov.clase === 'ingreso';
  return (
    <Hoja titulo={esIngreso ? 'Ingreso' : mov.tipo === 'impuestos' ? 'Pago de impuestos' : 'Gasto'} onCerrar={onCerrar}>
      <p class={`cifra cifra--media ${esIngreso ? 'entra' : ''}`}>{esIngreso ? '+' : '−'}{euros(mov.cent)}</p>
      <p class="nota">{[mov.concepto, fechaCorta(mov.fecha)].filter(Boolean).join(' · ')}</p>
      {esIngreso && Number(mov.impuestos) > 0 && <p class="nota">Apartado para impuestos: {euros(Math.round(mov.impuestos * 100))}</p>}
      <button type="button" class="btn btn--peligro btn--ancho" disabled={ocupado} onClick={onBorrar}>Borrar</button>
    </Hoja>
  );
}

// ───────── Ajustes del ámbito
const aNumero = (t) => Number(String(t).replace(',', '.'));

export function HojaAjustes({ ambito, usuario, esDemo, usuarioDemo, ocupado, onGuardar, onSalir, onCopia, onVerComo, onReiniciar, onCerrar }) {
  const [impuestos, setImpuestos] = useState(String(Number(ambito.pct_impuestos)));
  const [ahorro, setAhorro] = useState(String(Number(ambito.pct_ahorro)));
  const [colchon, setColchon] = useState(String(Number(ambito.colchon_meses)).replace('.', ','));

  const v = { pct_impuestos: aNumero(impuestos), pct_ahorro: aNumero(ahorro), colchon_meses: aNumero(colchon) };
  const valido = [v.pct_impuestos, v.pct_ahorro].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    && Number.isFinite(v.colchon_meses) && v.colchon_meses >= 0 && v.colchon_meses <= 24;

  return (
    <Hoja titulo={`Ajustes · ${ambito.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={(e) => { e.preventDefault(); if (valido) onGuardar(v); }}>
        <div class="trio">
          <Campo etiqueta="Impuestos %">
            <input type="text" inputMode="decimal" value={impuestos} onInput={(e) => setImpuestos(e.currentTarget.value)} />
          </Campo>
          <Campo etiqueta="Ahorro %">
            <input type="text" inputMode="decimal" value={ahorro} onInput={(e) => setAhorro(e.currentTarget.value)} />
          </Campo>
          <Campo etiqueta="Colchón (meses)">
            <input type="text" inputMode="decimal" value={colchon} onInput={(e) => setColchon(e.currentTarget.value)} />
          </Campo>
        </div>
        <p class="aclaracion">
          Impuestos: lo que se aparta de cada ingreso nuevo. Ahorro: parte de lo que queda tras impuestos y fijos.
          Colchón: cuántos meses de fijos quieres tener guardados antes de empezar a ahorrar.
          El porcentaje de impuestos es una estimación; confírmalo con tu gestoría.
        </p>
        <button type="submit" class="btn btn--principal btn--ancho" disabled={!valido || ocupado}>Guardar</button>
      </form>

      <div class="hoja__resto">
        <button type="button" class="btn btn--ancho" onClick={onCopia}>Descargar copia de mis datos</button>
        {esDemo ? (
          <>
            <button type="button" class="btn btn--ancho" onClick={() => onVerComo(usuarioDemo === 'alfonso' ? 'winslet' : 'alfonso')}>
              Ver como {usuarioDemo === 'alfonso' ? 'Winslet' : 'Alfonso'}
            </button>
            <button type="button" class="btn btn--ancho" onClick={onReiniciar}>Reiniciar los datos de prueba</button>
            <p class="aclaracion">Modo de prueba: cifras inventadas, guardadas solo en este dispositivo.</p>
          </>
        ) : (
          <>
            <button type="button" class="btn btn--ancho" onClick={onSalir}>Cerrar sesión</button>
            <p class="aclaracion">{usuario?.email}</p>
          </>
        )}
      </div>
    </Hoja>
  );
}
