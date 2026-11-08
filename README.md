# Piggi · Prototipo funcional

Sistema de gestión de horas extras: el empleado registra sus horas, el supervisor las aprueba o rechaza y el sistema calcula el pago con los recargos vigentes en Colombia (jornada de 42 horas, jornada nocturna desde las 7:00 p. m. y recargo dominical/festivo del 90 %).

Actividad 4 – Diseño del prototipo · Proyecto de Software · Corporación Universitaria Iberoamericana.
Autora: Yeni Daniela Echeverry Bohórquez.

## Cómo ejecutarlo

**Opción 1 – Sin instalar nada:** descarga el ZIP del repositorio (botón *Code > Download ZIP*), descomprímelo y abre `index.html` con Google Chrome o Microsoft Edge.

**Opción 2 – Con Node.js (v18 o superior):**

```bash
git clone https://github.com/Migox123/PIGGI-PROTOTIPO.git
cd PIGGI-PROTOTIPO
npm start        # abre http://localhost:3000
npm test         # ejecuta los 8 casos de prueba del cálculo
```

## Usuarios de prueba (contraseña `piggi123`)

| Rol | Correo |
|---|---|
| Empleado | empleado@piggi.co |
| Supervisor | supervisor@piggi.co |
| Administrador | admin@piggi.co |

## Estructura

```
index.html            Vista principal (login y aplicación)
css/estilos.css       Guía visual, diseño adaptable e impresión a PDF
js/calculadora.js     Clase CalculadoraHorasExtra (reglas de recargos)
js/modelos.js         Clases Usuario, SolicitudHoras y Repositorio
js/app.js             Clase PiggiApp (controlador de vistas)
tests/                Pruebas del módulo de cálculo
```

Los datos se guardan en el navegador (localStorage). Para volver a los datos iniciales: ingresar como administrador > *Parámetros legales* > *Restaurar datos de demostración*.
