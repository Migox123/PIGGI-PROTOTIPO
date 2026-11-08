/*
 * Piggi - Controlador principal de la interfaz
 * Une los modelos (modelos.js) y el cálculo (calculadora.js) con las vistas.
 */

const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const pesos = v => fmt.format(v || 0);
const horasTxt = h => `${Number(h.toFixed(2)).toString().replace('.', ',')} h`;
const fechaLarga = iso => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
const hora12 = hhmm => {
  const [h, m] = hhmm.split(':').map(Number);
  const sufijo = h >= 12 ? 'p. m.' : 'a. m.';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${sufijo}`;
};
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class PiggiApp {
  constructor() {
    this.repo = new Repositorio();
    this.calc = new CalculadoraHorasExtra();
    this.usuario = null;
    this.vista = 'inicio';
    this.$ = id => document.getElementById(id);
    this.enlazarEventos();
    const sesion = sessionStorage.getItem('piggi-sesion');
    if (sesion && this.repo.usuario(sesion)) this.iniciarSesion(this.repo.usuario(sesion), false);
  }

  // ---------------- Sesión ----------------
  enlazarEventos() {
    this.$('form-login').addEventListener('submit', e => {
      e.preventDefault();
      const correo = this.$('login-correo').value.trim();
      const clave = this.$('login-clave').value;
      const err = this.$('login-error');
      if (!correo || !clave) { err.textContent = 'Ingresa tu correo y tu contraseña.'; err.hidden = false; return; }
      const u = this.repo.buscarPorCorreo(correo);
      if (!u || u.clave !== clave) { err.textContent = 'Correo o contraseña incorrectos.'; err.hidden = false; return; }
      if (!u.activo) { err.textContent = 'Tu usuario está inactivo. Contacta a talento humano.'; err.hidden = false; return; }
      err.hidden = true;
      this.iniciarSesion(u, true);
    });
    document.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
      this.$('login-correo').value = b.dataset.demo;
      this.$('login-clave').value = 'piggi123';
    }));
    this.$('btn-salir').addEventListener('click', () => this.cerrarSesion());
    this.$('btn-menu').addEventListener('click', () => document.querySelector('.menu').classList.toggle('abierto'));
    this.$('btn-notif').addEventListener('click', e => { e.stopPropagation(); this.alternarNotificaciones(); });
    document.addEventListener('click', e => {
      if (!this.$('panel-notif').contains(e.target)) this.$('panel-notif').hidden = true;
    });
  }

  iniciarSesion(u, registrar) {
    this.usuario = u;
    sessionStorage.setItem('piggi-sesion', u.id);
    if (registrar) this.repo.registrarAccion(u, 'Inicio de sesión', 'Ingreso al sistema');
    this.$('vista-login').hidden = true;
    this.$('vista-app').hidden = false;
    this.$('perfil-avatar').textContent = u.iniciales;
    this.$('perfil-nombre').textContent = u.nombre;
    this.$('perfil-rol').textContent = `${u.rol} · ${u.area}`;
    this.pintarMenu();
    this.ir('inicio');
  }

  cerrarSesion() {
    this.repo.registrarAccion(this.usuario, 'Cierre de sesión', 'Salida del sistema');
    sessionStorage.removeItem('piggi-sesion');
    this.usuario = null;
    this.$('vista-app').hidden = true;
    this.$('vista-login').hidden = false;
    this.$('form-login').reset();
  }

  // ---------------- Navegación ----------------
  opcionesMenu() {
    const r = this.usuario.rol;
    const op = [{ id: 'inicio', icono: '🏠', texto: 'Inicio' }];
    if (r === ROLES.EMPLEADO) {
      op.push({ id: 'registrar', icono: '➕', texto: 'Registrar horas' }, { id: 'mis', icono: '📋', texto: 'Mis solicitudes' });
    }
    if (r === ROLES.SUPERVISOR) {
      op.push({ id: 'aprobaciones', icono: '✅', texto: 'Aprobaciones' }, { id: 'reportes', icono: '📊', texto: 'Reportes' });
    }
    if (r === ROLES.ADMIN) {
      op.push({ id: 'usuarios', icono: '👥', texto: 'Usuarios y roles' }, { id: 'reportes', icono: '📊', texto: 'Reportes y nómina' },
              { id: 'auditoria', icono: '🛡️', texto: 'Auditoría' }, { id: 'parametros', icono: '⚙️', texto: 'Parámetros legales' });
    }
    return op;
  }

  pintarMenu() {
    this.$('nav').innerHTML = this.opcionesMenu()
      .map(o => `<a href="#" data-vista="${o.id}"><span>${o.icono}</span>${o.texto}</a>`).join('');
    this.$('nav').querySelectorAll('a').forEach(a => a.addEventListener('click', e => {
      e.preventDefault(); this.ir(a.dataset.vista); document.querySelector('.menu').classList.remove('abierto');
    }));
  }

  ir(vista) {
    this.vista = vista;
    this.$('nav').querySelectorAll('a').forEach(a => a.classList.toggle('activo', a.dataset.vista === vista));
    const opcion = this.opcionesMenu().find(o => o.id === vista);
    this.$('titulo-vista').textContent = opcion ? opcion.texto : 'Inicio';
    const vistas = {
      inicio: () => this.vistaInicio(), registrar: () => this.vistaRegistrar(), mis: () => this.vistaMisSolicitudes(),
      aprobaciones: () => this.vistaAprobaciones(), reportes: () => this.vistaReportes(), usuarios: () => this.vistaUsuarios(),
      auditoria: () => this.vistaAuditoria(), parametros: () => this.vistaParametros()
    };
    (vistas[vista] || vistas.inicio)();
    this.actualizarContadorNotif();
  }

  // ---------------- Utilidades ----------------
  toast(msg, tipo = '') {
    const t = this.$('toast');
    t.textContent = msg; t.className = `toast ${tipo}`; t.hidden = false;
    clearTimeout(this._toast); this._toast = setTimeout(() => { t.hidden = true; }, 3200);
  }

  modal(html) { this.$('modal-caja').innerHTML = html; this.$('modal').hidden = false; }
  cerrarModal() { this.$('modal').hidden = true; }

  calculoDe(s) {
    if (s.calculo) return s.calculo;
    const emp = this.repo.usuario(s.empleadoId);
    return this.calc.calcular(emp.salario, s.fecha, s.horaInicio, s.horaFin);
  }

  actualizarContadorNotif() {
    const n = this.repo.notificaciones(this.usuario.id).filter(x => !x.leida).length;
    const c = this.$('notif-cont');
    c.textContent = n; c.hidden = n === 0;
  }

  alternarNotificaciones() {
    const p = this.$('panel-notif');
    if (!p.hidden) { p.hidden = true; return; }
    const lista = this.repo.notificaciones(this.usuario.id);
    p.innerHTML = lista.length
      ? lista.slice(0, 8).map(n => `<div class="item ${n.leida ? '' : 'nueva'}">${esc(n.mensaje)}<small>${new Date(n.fecha).toLocaleString('es-CO')}</small></div>`).join('')
      : '<p class="vacio">No tienes notificaciones.</p>';
    p.hidden = false;
    this.repo.marcarLeidas(this.usuario.id);
    this.actualizarContadorNotif();
  }

  filaSolicitud(s, { mostrarEmpleado = false, acciones = '' } = {}) {
    const c = this.calculoDe(s);
    const emp = this.repo.usuario(s.empleadoId);
    return `<tr>
      <td><strong>${s.id}</strong></td>
      ${mostrarEmpleado ? `<td>${esc(emp.nombre)}<br><span class="muted">${esc(emp.cargo)}</span></td>` : ''}
      <td>${fechaLarga(s.fecha)}<br><span class="muted">${hora12(s.horaInicio)} – ${hora12(s.horaFin)}</span></td>
      <td>${horasTxt(c.totalHoras)}<br><span class="muted">${c.detalle.map(d => d.tipo).join(' + ')}</span></td>
      <td>${esc(s.motivo)}${s.comentario ? `<br><span class="muted">💬 ${esc(s.comentario)}</span>` : ''}</td>
      <td><strong>${pesos(c.total)}</strong></td>
      <td><span class="estado ${s.estado}">${s.estado}</span></td>
      ${acciones ? `<td>${acciones}</td>` : ''}
    </tr>`;
  }

  // ---------------- Vistas ----------------
  vistaInicio() {
    const r = this.usuario.rol;
    const todas = this.repo.solicitudes();
    const propias = r === ROLES.EMPLEADO ? todas.filter(s => s.empleadoId === this.usuario.id) : todas;
    const suma = (lista, campo) => lista.reduce((a, s) => a + this.calculoDe(s)[campo], 0);
    const pend = propias.filter(s => s.estado === ESTADOS.PENDIENTE);
    const apr = propias.filter(s => s.estado === ESTADOS.APROBADA);
    const rech = propias.filter(s => s.estado === ESTADOS.RECHAZADA);
    const saludo = `Hola, ${esc(this.usuario.nombre.split(' ')[0])} 👋`;
    const textoRol = {
      [ROLES.EMPLEADO]: 'Aquí ves el estado de tus horas extras y lo que te van a pagar.',
      [ROLES.SUPERVISOR]: 'Estas son las solicitudes de tu equipo que esperan revisión.',
      [ROLES.ADMIN]: 'Resumen general de horas extras de la empresa.'
    }[r];
    this.$('contenido').innerHTML = `
      <div class="tarjeta"><h3 style="font-size:20px">${saludo}</h3><p class="muted" style="margin:0">${textoRol}</p></div>
      <div class="grid-kpi">
        <div class="kpi ambar"><span>Solicitudes pendientes</span><strong>${pend.length}</strong></div>
        <div class="kpi verde"><span>Horas aprobadas</span><strong>${horasTxt(suma(apr, 'totalHoras'))}</strong></div>
        <div class="kpi"><span>${r === ROLES.EMPLEADO ? 'Valor a pagar (aprobado)' : 'Valor aprobado del periodo'}</span><strong>${pesos(suma(apr, 'total'))}</strong></div>
        <div class="kpi azul"><span>Rechazadas</span><strong>${rech.length}</strong></div>
      </div>
      <div class="tarjeta">
        <h3>${r === ROLES.EMPLEADO ? 'Mis últimas solicitudes' : 'Últimas solicitudes registradas'}</h3>
        <div class="tabla-scroll"><table>
          <thead><tr><th>ID</th>${r !== ROLES.EMPLEADO ? '<th>Empleado</th>' : ''}<th>Fecha y horario</th><th>Horas</th><th>Motivo</th><th>Valor</th><th>Estado</th></tr></thead>
          <tbody>${propias.slice(0, 5).map(s => this.filaSolicitud(s, { mostrarEmpleado: r !== ROLES.EMPLEADO })).join('') || '<tr><td colspan="7" class="vacio">Sin registros</td></tr>'}</tbody>
        </table></div>
        ${r === ROLES.EMPLEADO ? '<button class="btn btn-primario" id="ir-registrar" style="margin-top:14px">➕ Registrar horas extras</button>' : ''}
        ${r === ROLES.SUPERVISOR && pend.length ? '<button class="btn btn-primario" id="ir-aprobar" style="margin-top:14px">Revisar pendientes</button>' : ''}
      </div>`;
    const b1 = this.$('ir-registrar'); if (b1) b1.onclick = () => this.ir('registrar');
    const b2 = this.$('ir-aprobar'); if (b2) b2.onclick = () => this.ir('aprobaciones');
  }

  vistaRegistrar() {
    const hoy = CalculadoraHorasExtra.fechaISO(new Date());
    this.$('contenido').innerHTML = `
      <div class="dos-col">
        <div class="tarjeta">
          <h3>Nueva solicitud de horas extras</h3>
          <form id="form-horas" novalidate>
            <label>Fecha en que se trabajó<input type="date" id="h-fecha" max="${hoy}" value="${hoy}" required></label>
            <div class="fila">
              <label>Hora de inicio<input type="time" id="h-inicio" value="17:00" required></label>
              <label>Hora de fin<input type="time" id="h-fin" value="19:00" required></label>
            </div>
            <label>Motivo o actividad realizada<textarea id="h-motivo" rows="3" placeholder="Ej.: cierre de incidentes, inventario, atención a cliente…" required></textarea></label>
            <div id="h-avisos"></div>
            <button type="submit" class="btn btn-primario">Enviar a aprobación</button>
          </form>
        </div>
        <div class="tarjeta">
          <h3>Cálculo automático</h3>
          <div id="h-preview" class="resumen-calculo"></div>
          <p class="muted" style="margin-top:12px">Si la hora de fin es menor que la de inicio, Piggi entiende que el turno pasó al día siguiente. Jornada nocturna desde las 7:00 p. m. (Ley 2466 de 2025).</p>
        </div>
      </div>`;
    const actualizar = () => this.previsualizar();
    ['h-fecha', 'h-inicio', 'h-fin'].forEach(id => this.$(id).addEventListener('input', actualizar));
    actualizar();
    this.$('form-horas').addEventListener('submit', e => { e.preventDefault(); this.guardarSolicitud(); });
  }

  validarRegistro(fecha, inicio, fin, motivo) {
    const errores = [], avisos = [];
    if (!fecha || !inicio || !fin) errores.push('Completa la fecha y el horario.');
    if (!motivo || motivo.trim().length < 5) errores.push('Describe brevemente la actividad (mínimo 5 caracteres).');
    if (fecha && fecha > CalculadoraHorasExtra.fechaISO(new Date())) errores.push('No puedes registrar horas en una fecha futura.');
    if (fecha && inicio && fin) {
      if (inicio === fin) errores.push('La hora de inicio y la de fin no pueden ser iguales.');
      const nuevo = CalculadoraHorasExtra.intervalo(fecha, inicio, fin);
      const horas = (nuevo.fin - nuevo.inicio) / 3600000;
      if (horas > 12) errores.push('Un registro no puede superar 12 horas.');
      const choca = this.repo.solicitudes().some(s => {
        if (s.empleadoId !== this.usuario.id || s.estado === ESTADOS.RECHAZADA) return false;
        const x = CalculadoraHorasExtra.intervalo(s.fecha, s.horaInicio, s.horaFin);
        return nuevo.inicio < x.fin && x.inicio < nuevo.fin;
      });
      if (choca) errores.push('Ya tienes un registro que se cruza con ese horario.');
      if (horas > CONFIG_LEGAL.limiteDiarioHorasExtra && horas <= 12) {
        avisos.push(`Atención: superas el límite legal de ${CONFIG_LEGAL.limiteDiarioHorasExtra} horas extra diarias. El supervisor deberá justificar la aprobación.`);
      }
    }
    return { errores, avisos };
  }

  previsualizar() {
    const fecha = this.$('h-fecha').value, ini = this.$('h-inicio').value, fin = this.$('h-fin').value;
    const prev = this.$('h-preview');
    const { errores, avisos } = this.validarRegistro(fecha, ini, fin, 'xxxxx');
    this.$('h-avisos').innerHTML = [...errores, ...avisos].map(a => `<div class="aviso">${a}</div>`).join('');
    if (!fecha || !ini || !fin || ini === fin) { prev.innerHTML = '<span class="muted">Ingresa el horario para ver el cálculo.</span>'; return; }
    const c = this.calc.calcular(this.usuario.salario, fecha, ini, fin);
    prev.innerHTML = `
      <div class="muted">Salario base ${pesos(this.usuario.salario)} · Hora ordinaria ${pesos(c.valorHora)} (salario ÷ ${CONFIG_LEGAL.divisorMensual})</div>
      <table style="margin:10px 0"><thead><tr><th>Tipo</th><th>Horas</th><th>Factor</th><th>Valor</th></tr></thead>
      <tbody>${c.detalle.map(d => `<tr><td>${d.nombre}</td><td>${horasTxt(d.horas)}</td><td>×${d.factor.toFixed(2).replace('.', ',')}</td><td>${pesos(d.valor)}</td></tr>`).join('')}</tbody></table>
      <div>Total estimado: <span class="total">${pesos(c.total)}</span></div>`;
  }

  guardarSolicitud() {
    const fecha = this.$('h-fecha').value, ini = this.$('h-inicio').value, fin = this.$('h-fin').value, motivo = this.$('h-motivo').value.trim();
    const { errores } = this.validarRegistro(fecha, ini, fin, motivo);
    if (errores.length) { this.toast(errores[0], 'error'); return; }
    const s = new SolicitudHoras({ id: this.repo.siguienteId('HE'), empleadoId: this.usuario.id, fecha, horaInicio: ini, horaFin: fin, motivo });
    this.repo.guardarSolicitud(s);
    this.repo.registrarAccion(this.usuario, 'Registro de horas', `Creó la solicitud ${s.id} (${fecha} ${ini}-${fin})`);
    this.repo.usuarios().filter(u => u.rol === ROLES.SUPERVISOR && u.area === this.usuario.area)
      .forEach(sup => this.repo.notificar(sup.id, `${this.usuario.nombre} registró la solicitud ${s.id}.`));
    this.toast(`Solicitud ${s.id} enviada a aprobación ✔`);
    this.ir('mis');
  }

  vistaMisSolicitudes() {
    const lista = this.repo.solicitudes().filter(s => s.empleadoId === this.usuario.id);
    this.$('contenido').innerHTML = `
      <div class="tarjeta">
        <div class="filtros"><select id="f-estado"><option value="">Todos los estados</option>${Object.values(ESTADOS).map(e => `<option>${e}</option>`).join('')}</select></div>
        <div class="tabla-scroll"><table>
          <thead><tr><th>ID</th><th>Fecha y horario</th><th>Horas</th><th>Motivo</th><th>Valor</th><th>Estado</th></tr></thead>
          <tbody id="t-mis"></tbody></table></div>
      </div>`;
    const pintar = () => {
      const f = this.$('f-estado').value;
      const filas = lista.filter(s => !f || s.estado === f).map(s => this.filaSolicitud(s)).join('');
      this.$('t-mis').innerHTML = filas || '<tr><td colspan="6" class="vacio">No hay solicitudes con ese filtro.</td></tr>';
    };
    this.$('f-estado').onchange = pintar; pintar();
  }

  vistaAprobaciones() {
    const misEmpleados = this.repo.usuarios().filter(u => u.area === this.usuario.area && u.rol === ROLES.EMPLEADO).map(u => u.id);
    const lista = this.repo.solicitudes().filter(s => misEmpleados.includes(s.empleadoId));
    const pend = lista.filter(s => s.estado === ESTADOS.PENDIENTE);
    const rev = lista.filter(s => s.estado !== ESTADOS.PENDIENTE);
    const acciones = s => `<div class="acciones"><button class="btn btn-exito btn-peq" data-aprobar="${s.id}">Aprobar</button><button class="btn btn-peligro btn-peq" data-rechazar="${s.id}">Rechazar</button></div>`;
    this.$('contenido').innerHTML = `
      <div class="tarjeta"><h3>Pendientes por revisar (${pend.length})</h3>
        <div class="tabla-scroll"><table>
          <thead><tr><th>ID</th><th>Empleado</th><th>Fecha y horario</th><th>Horas</th><th>Motivo</th><th>Valor</th><th>Estado</th><th>Acción</th></tr></thead>
          <tbody>${pend.map(s => this.filaSolicitud(s, { mostrarEmpleado: true, acciones: acciones(s) })).join('') || '<tr><td colspan="8" class="vacio">No hay solicitudes pendientes 🎉</td></tr>'}</tbody>
        </table></div></div>
      <div class="tarjeta"><h3>Historial revisado</h3>
        <div class="tabla-scroll"><table>
          <thead><tr><th>ID</th><th>Empleado</th><th>Fecha y horario</th><th>Horas</th><th>Motivo</th><th>Valor</th><th>Estado</th></tr></thead>
          <tbody>${rev.map(s => this.filaSolicitud(s, { mostrarEmpleado: true })).join('') || '<tr><td colspan="7" class="vacio">Sin historial</td></tr>'}</tbody>
        </table></div></div>`;
    this.$('contenido').querySelectorAll('[data-aprobar]').forEach(b => b.onclick = () => this.revisar(b.dataset.aprobar, true));
    this.$('contenido').querySelectorAll('[data-rechazar]').forEach(b => b.onclick = () => this.revisar(b.dataset.rechazar, false));
  }

  revisar(id, aprobar) {
    const s = this.repo.solicitud(id);
    const emp = this.repo.usuario(s.empleadoId);
    const c = this.calculoDe(s);
    this.modal(`
      <h3>${aprobar ? 'Aprobar' : 'Rechazar'} solicitud ${s.id}</h3>
      <p class="muted">${esc(emp.nombre)} · ${fechaLarga(s.fecha)} · ${hora12(s.horaInicio)} – ${hora12(s.horaFin)} · ${horasTxt(c.totalHoras)} · <strong>${pesos(c.total)}</strong></p>
      <label>Comentario ${aprobar ? '(opcional)' : '(obligatorio)'}<textarea id="m-coment" rows="3"></textarea></label>
      <div class="modal-pie"><button class="btn btn-sec" id="m-cancelar">Cancelar</button>
      <button class="btn ${aprobar ? 'btn-exito' : 'btn-primario'}" id="m-ok">${aprobar ? 'Confirmar aprobación' : 'Confirmar rechazo'}</button></div>`);
    this.$('m-cancelar').onclick = () => this.cerrarModal();
    this.$('m-ok').onclick = () => {
      const comentario = this.$('m-coment').value.trim();
      if (!aprobar && comentario.length < 5) { this.toast('Indica el motivo del rechazo.', 'error'); return; }
      s.estado = aprobar ? ESTADOS.APROBADA : ESTADOS.RECHAZADA;
      s.comentario = comentario; s.revisadaPor = this.usuario.id;
      if (aprobar) s.calculo = this.calc.calcular(emp.salario, s.fecha, s.horaInicio, s.horaFin); // se congela el valor aprobado
      this.repo.guardarSolicitud(s);
      this.repo.registrarAccion(this.usuario, aprobar ? 'Aprobación' : 'Rechazo', `${aprobar ? 'Aprobó' : 'Rechazó'} la solicitud ${s.id}`);
      this.repo.notificar(emp.id, `Tu solicitud ${s.id} fue ${s.estado.toLowerCase()} por ${this.usuario.nombre}.${comentario ? ' Comentario: ' + comentario : ''}`);
      this.cerrarModal();
      this.toast(`Solicitud ${s.id} ${s.estado.toLowerCase()}`);
      this.vistaAprobaciones();
    };
  }

  datosReporte(mes, empleadoId) {
    return this.repo.solicitudes().filter(s => s.estado === ESTADOS.APROBADA && s.fecha.startsWith(mes) && (!empleadoId || s.empleadoId === empleadoId));
  }

  vistaReportes() {
    const meses = [...new Set(this.repo.solicitudes().map(s => s.fecha.slice(0, 7)))].sort().reverse();
    const empleados = this.repo.usuarios().filter(u => u.rol === ROLES.EMPLEADO);
    this.$('contenido').innerHTML = `
      <div class="tarjeta">
        <div class="filtros no-print">
          <select id="r-mes">${meses.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
          <select id="r-emp"><option value="">Todos los empleados</option>${empleados.map(e => `<option value="${e.id}">${esc(e.nombre)}</option>`).join('')}</select>
          <button class="btn btn-primario btn-peq" id="r-pdf">⬇ Exportar PDF</button>
          <button class="btn btn-sec btn-peq" id="r-csv">⬇ Archivo para nómina (CSV)</button>
        </div>
        <div class="solo-print"><h2>Piggi · Reporte de horas extras aprobadas</h2><p id="r-sub"></p></div>
        <div id="r-cuerpo"></div>
      </div>`;
    const pintar = () => {
      const mes = this.$('r-mes').value, emp = this.$('r-emp').value;
      const datos = this.datosReporte(mes, emp);
      const porEmpleado = {};
      datos.forEach(s => {
        const c = this.calculoDe(s);
        const e = porEmpleado[s.empleadoId] ||= { HED: 0, HEN: 0, HEDDF: 0, HENDF: 0, horas: 0, total: 0 };
        c.detalle.forEach(d => { e[d.tipo] += d.horas; });
        e.horas += c.totalHoras; e.total += c.total;
      });
      const filas = Object.entries(porEmpleado).map(([id, e]) => {
        const u = this.repo.usuario(id);
        return `<tr><td>${esc(u.nombre)}</td><td>${horasTxt(e.HED)}</td><td>${horasTxt(e.HEN)}</td><td>${horasTxt(e.HEDDF)}</td><td>${horasTxt(e.HENDF)}</td><td><strong>${horasTxt(e.horas)}</strong></td><td><strong>${pesos(e.total)}</strong></td></tr>`;
      }).join('');
      const total = Object.values(porEmpleado).reduce((a, e) => a + e.total, 0);
      this.$('r-sub').textContent = `Periodo ${mes} · generado el ${new Date().toLocaleString('es-CO')}`;
      this.$('r-cuerpo').innerHTML = `
        <div class="tabla-scroll"><table>
          <thead><tr><th>Empleado</th><th>HED 25 %</th><th>HEN 75 %</th><th>HEDDF 115 %</th><th>HENDF 165 %</th><th>Total horas</th><th>Valor a pagar</th></tr></thead>
          <tbody>${filas || '<tr><td colspan="7" class="vacio">No hay horas aprobadas en este periodo.</td></tr>'}</tbody>
        </table></div>
        <p style="text-align:right;font-size:18px;margin:16px 4px 0">Total del periodo: <strong style="color:var(--primario)">${pesos(total)}</strong></p>`;
      this._reporte = { mes, datos };
    };
    this.$('r-mes').onchange = pintar; this.$('r-emp').onchange = pintar; pintar();
    this.$('r-pdf').onclick = () => { this.repo.registrarAccion(this.usuario, 'Exportación', `Reporte PDF ${this._reporte.mes}`); window.print(); };
    this.$('r-csv').onclick = () => this.exportarCSV();
  }

  exportarCSV() {
    const { mes, datos } = this._reporte;
    const filas = [['id_solicitud', 'documento_empleado', 'empleado', 'fecha', 'tipo_hora', 'horas', 'valor']];
    datos.forEach(s => {
      const u = this.repo.usuario(s.empleadoId);
      this.calculoDe(s).detalle.forEach(d => filas.push([s.id, u.id, u.nombre, s.fecha, d.tipo, d.horas.toFixed(2), d.valor]));
    });
    const csv = filas.map(f => f.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `piggi_nomina_${mes}.csv`; a.click();
    this.repo.registrarAccion(this.usuario, 'Exportación', `Archivo de nómina CSV ${mes}`);
    this.toast('Archivo para nómina generado ✔');
  }

  vistaUsuarios() {
    const lista = this.repo.usuarios();
    this.$('contenido').innerHTML = `
      <div class="tarjeta">
        <div class="filtros"><button class="btn btn-primario btn-peq" id="u-nuevo">➕ Nuevo usuario</button></div>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Área / cargo</th><th>Salario</th><th>Estado</th><th></th></tr></thead>
          <tbody>${lista.map(u => `<tr><td><strong>${esc(u.nombre)}</strong></td><td>${esc(u.correo)}</td><td>${u.rol}</td><td>${esc(u.area)}<br><span class="muted">${esc(u.cargo)}</span></td><td>${pesos(u.salario)}</td>
            <td><span class="estado ${u.activo ? 'Aprobada' : 'Rechazada'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td><button class="btn btn-sec btn-peq" data-editar="${u.id}">Editar</button></td></tr>`).join('')}</tbody>
        </table></div></div>`;
    this.$('u-nuevo').onclick = () => this.formUsuario();
    this.$('contenido').querySelectorAll('[data-editar]').forEach(b => b.onclick = () => this.formUsuario(this.repo.usuario(b.dataset.editar)));
  }

  formUsuario(u) {
    const nuevo = !u;
    u = u || new Usuario({ id: '', nombre: '', correo: '', clave: 'piggi123', rol: ROLES.EMPLEADO, area: 'Operaciones', cargo: '', salario: 1750905 });
    this.modal(`
      <h3>${nuevo ? 'Nuevo usuario' : 'Editar usuario'}</h3>
      <label>Nombre completo<input id="u-nombre" value="${esc(u.nombre)}"></label>
      <label>Correo<input id="u-correo" type="email" value="${esc(u.correo)}"></label>
      <div class="fila"><label>Rol<select id="u-rol">${Object.values(ROLES).map(r => `<option ${r === u.rol ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      <label>Salario mensual<input id="u-salario" type="number" min="1750905" step="1000" value="${u.salario}"></label></div>
      <div class="fila"><label>Área<input id="u-area" value="${esc(u.area)}"></label><label>Cargo<input id="u-cargo" value="${esc(u.cargo)}"></label></div>
      ${nuevo ? '' : `<label><input type="checkbox" id="u-activo" ${u.activo ? 'checked' : ''} style="display:inline;width:auto"> Usuario activo</label>`}
      <div class="modal-pie"><button class="btn btn-sec" id="m-cancelar">Cancelar</button><button class="btn btn-primario" id="m-ok">Guardar</button></div>`);
    this.$('m-cancelar').onclick = () => this.cerrarModal();
    this.$('m-ok').onclick = () => {
      const datos = {
        ...u, nombre: this.$('u-nombre').value.trim(), correo: this.$('u-correo').value.trim(), rol: this.$('u-rol').value,
        salario: Number(this.$('u-salario').value), area: this.$('u-area').value.trim(), cargo: this.$('u-cargo').value.trim(),
        activo: nuevo ? true : this.$('u-activo').checked
      };
      if (datos.nombre.length < 3 || !/^\S+@\S+\.\S+$/.test(datos.correo)) { this.toast('Revisa el nombre y el correo.', 'error'); return; }
      if (datos.salario < 1750905) { this.toast('El salario no puede ser inferior al mínimo de 2026 ($1.750.905).', 'error'); return; }
      const otro = this.repo.buscarPorCorreo(datos.correo);
      if (otro && otro.id !== u.id) { this.toast('Ya existe un usuario con ese correo.', 'error'); return; }
      if (nuevo) datos.id = this.repo.siguienteId('U');
      this.repo.guardarUsuario(datos);
      this.repo.registrarAccion(this.usuario, nuevo ? 'Creación de usuario' : 'Edición de usuario', `${datos.nombre} (${datos.rol})`);
      this.cerrarModal(); this.toast('Usuario guardado ✔'); this.vistaUsuarios();
    };
  }

  vistaAuditoria() {
    const lista = this.repo.auditoria();
    this.$('contenido').innerHTML = `
      <div class="tarjeta"><h3>Registro de interacciones (${lista.length})</h3>
        <div class="tabla-scroll"><table>
          <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Rol</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>${lista.map(a => `<tr><td>${new Date(a.fecha).toLocaleString('es-CO')}</td><td>${esc(a.usuario)}</td><td>${a.rol}</td><td><strong>${esc(a.accion)}</strong></td><td>${esc(a.detalle)}</td></tr>`).join('')}</tbody>
        </table></div></div>`;
  }

  vistaParametros() {
    const r = CONFIG_LEGAL.recargos;
    const pct = v => `${Math.round(v * 100)} %`;
    this.$('contenido').innerHTML = `
      <div class="dos-col">
        <div class="tarjeta"><h3>Parámetros de cálculo vigentes</h3>
          <table><tbody>
            <tr><td>Jornada máxima semanal</td><td><strong>${CONFIG_LEGAL.horasSemanales} horas</strong></td></tr>
            <tr><td>Divisor mensual (valor hora)</td><td><strong>${CONFIG_LEGAL.divisorMensual}</strong></td></tr>
            <tr><td>Jornada nocturna</td><td><strong>7:00 p. m. – 6:00 a. m.</strong></td></tr>
            <tr><td>Hora extra diurna (HED)</td><td><strong>${pct(r.HED)}</strong></td></tr>
            <tr><td>Hora extra nocturna (HEN)</td><td><strong>${pct(r.HEN)}</strong></td></tr>
            <tr><td>Extra diurna dominical/festiva (HEDDF)</td><td><strong>${pct(r.HEDDF)}</strong></td></tr>
            <tr><td>Extra nocturna dominical/festiva (HENDF)</td><td><strong>${pct(r.HENDF)}</strong></td></tr>
            <tr><td>Límite de horas extra</td><td><strong>${CONFIG_LEGAL.limiteDiarioHorasExtra} diarias · ${CONFIG_LEGAL.limiteSemanalHorasExtra} semanales</strong></td></tr>
          </tbody></table></div>
        <div class="tarjeta"><h3>Festivos 2026 cargados</h3>
          <p class="muted">${FESTIVOS_2026.map(f => fechaLarga(f)).join(' · ')}</p>
          <div class="aviso" style="margin-top:12px">Desde el 1 de julio de 2027 el recargo dominical y festivo sube al 100 % (Ley 2466 de 2025). Solo hay que actualizar este parámetro.</div>
          <button class="btn btn-sec btn-peq" id="p-reset">Restaurar datos de demostración</button>
        </div>
      </div>`;
    this.$('p-reset').onclick = () => {
      this.repo.reiniciar(); this.toast('Datos de demostración restaurados');
      this.usuario = this.repo.usuario(this.usuario.id); this.ir('parametros');
    };
  }
}

window.addEventListener('DOMContentLoaded', () => { window.piggi = new PiggiApp(); });
