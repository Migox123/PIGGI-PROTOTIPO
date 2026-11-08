/*
 * Piggi - Modelos de dominio y persistencia
 * En este prototipo la información se guarda en el navegador (localStorage)
 * para que funcione sin servidor. En la versión final este repositorio se
 * reemplaza por una API REST con base de datos.
 */

const ROLES = { EMPLEADO: 'Empleado', SUPERVISOR: 'Supervisor', ADMIN: 'Administrador' };
const ESTADOS = { PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' };

class Usuario {
  constructor({ id, nombre, correo, clave, rol, area, cargo, salario, activo = true }) {
    Object.assign(this, { id, nombre, correo, clave, rol, area, cargo, salario, activo });
  }
  get iniciales() {
    return this.nombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
}

class SolicitudHoras {
  constructor({ id, empleadoId, fecha, horaInicio, horaFin, motivo, estado = ESTADOS.PENDIENTE,
                creada = new Date().toISOString(), revisadaPor = null, comentario = '', calculo = null }) {
    Object.assign(this, { id, empleadoId, fecha, horaInicio, horaFin, motivo, estado, creada, revisadaPor, comentario, calculo });
  }
}

class Repositorio {
  constructor(clave = 'piggi-db-v1') {
    this.clave = clave;
    this.datos = this.cargar();
  }

  cargar() {
    try {
      const raw = localStorage.getItem(this.clave);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* almacenamiento no disponible: se usan datos en memoria */ }
    return Repositorio.datosIniciales();
  }

  guardar() {
    try { localStorage.setItem(this.clave, JSON.stringify(this.datos)); } catch (e) { /* sin persistencia */ }
  }

  reiniciar() {
    this.datos = Repositorio.datosIniciales();
    this.guardar();
  }

  siguienteId(prefijo) {
    this.datos.secuencia = (this.datos.secuencia || 100) + 1;
    return `${prefijo}-${this.datos.secuencia}`;
  }

  // ---- Usuarios
  usuarios() { return this.datos.usuarios.map(u => new Usuario(u)); }
  usuario(id) { return this.usuarios().find(u => u.id === id); }
  buscarPorCorreo(correo) { return this.usuarios().find(u => u.correo.toLowerCase() === correo.toLowerCase()); }
  guardarUsuario(u) {
    const i = this.datos.usuarios.findIndex(x => x.id === u.id);
    if (i >= 0) this.datos.usuarios[i] = { ...u }; else this.datos.usuarios.push({ ...u });
    this.guardar();
  }

  // ---- Solicitudes
  solicitudes() { return this.datos.solicitudes.map(s => new SolicitudHoras(s)); }
  solicitud(id) { return this.solicitudes().find(s => s.id === id); }
  guardarSolicitud(s) {
    const i = this.datos.solicitudes.findIndex(x => x.id === s.id);
    if (i >= 0) this.datos.solicitudes[i] = { ...s }; else this.datos.solicitudes.unshift({ ...s });
    this.guardar();
  }

  // ---- Notificaciones
  notificaciones(usuarioId) { return this.datos.notificaciones.filter(n => n.usuarioId === usuarioId); }
  notificar(usuarioId, mensaje) {
    this.datos.notificaciones.unshift({ id: this.siguienteId('N'), usuarioId, mensaje, fecha: new Date().toISOString(), leida: false });
    this.guardar();
  }
  marcarLeidas(usuarioId) {
    this.datos.notificaciones.forEach(n => { if (n.usuarioId === usuarioId) n.leida = true; });
    this.guardar();
  }

  // ---- Auditoría
  auditoria() { return this.datos.auditoria; }
  registrarAccion(usuario, accion, detalle) {
    this.datos.auditoria.unshift({
      fecha: new Date().toISOString(),
      usuario: usuario ? usuario.nombre : 'Sistema',
      rol: usuario ? usuario.rol : '-',
      accion, detalle
    });
    this.guardar();
  }

  static datosIniciales() {
    const usuarios = [
      { id: 'U-1', nombre: 'Laura Gómez Rincón', correo: 'empleado@piggi.co', clave: 'piggi123', rol: ROLES.EMPLEADO, area: 'Operaciones', cargo: 'Analista de soporte', salario: 2100000 },
      { id: 'U-2', nombre: 'Andrés Pardo Ruiz', correo: 'andres@piggi.co', clave: 'piggi123', rol: ROLES.EMPLEADO, area: 'Operaciones', cargo: 'Técnico de campo', salario: 1890000 },
      { id: 'U-3', nombre: 'Carlos Mejía Torres', correo: 'supervisor@piggi.co', clave: 'piggi123', rol: ROLES.SUPERVISOR, area: 'Operaciones', cargo: 'Supervisor de turno', salario: 3800000 },
      { id: 'U-4', nombre: 'Natalia Ríos Vargas', correo: 'admin@piggi.co', clave: 'piggi123', rol: ROLES.ADMIN, area: 'Talento humano', cargo: 'Coordinadora de nómina', salario: 4500000 }
    ];
    const s = (id, empleadoId, fecha, horaInicio, horaFin, motivo, estado, comentario = '') =>
      ({ id, empleadoId, fecha, horaInicio, horaFin, motivo, estado, comentario, creada: `${fecha}T23:00:00.000Z`, revisadaPor: estado === ESTADOS.PENDIENTE ? null : 'U-3' });
    const solicitudes = [
      s('HE-101', 'U-1', '2026-11-03', '17:00', '19:00', 'Cierre de incidentes del turno', ESTADOS.APROBADA, 'Validado con bitácora'),
      s('HE-102', 'U-1', '2026-11-05', '18:00', '20:00', 'Migración de servidores', ESTADOS.APROBADA),
      s('HE-103', 'U-2', '2026-11-04', '19:00', '21:00', 'Mantenimiento preventivo UPS', ESTADOS.PENDIENTE),
      s('HE-104', 'U-1', '2026-11-08', '08:00', '10:00', 'Ventana de cambios dominical', ESTADOS.PENDIENTE),
      s('HE-105', 'U-2', '2026-11-02', '15:00', '17:00', 'Soporte en sitio a cliente', ESTADOS.RECHAZADA, 'No hay orden de trabajo asociada')
    ];
    return {
      secuencia: 105,
      usuarios,
      solicitudes,
      notificaciones: [
        { id: 'N-1', usuarioId: 'U-1', mensaje: 'Tu solicitud HE-101 fue aprobada por Carlos Mejía Torres.', fecha: '2026-11-04T14:00:00.000Z', leida: false },
        { id: 'N-2', usuarioId: 'U-3', mensaje: 'Andrés Pardo Ruiz registró la solicitud HE-103.', fecha: '2026-11-05T02:00:00.000Z', leida: false }
      ],
      auditoria: [
        { fecha: '2026-11-04T14:00:00.000Z', usuario: 'Carlos Mejía Torres', rol: ROLES.SUPERVISOR, accion: 'Aprobación', detalle: 'Aprobó la solicitud HE-101' },
        { fecha: '2026-11-04T13:55:00.000Z', usuario: 'Carlos Mejía Torres', rol: ROLES.SUPERVISOR, accion: 'Inicio de sesión', detalle: 'Ingreso al sistema' }
      ]
    };
  }
}
