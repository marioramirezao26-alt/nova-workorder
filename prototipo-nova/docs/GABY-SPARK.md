# Gaby Spark en el prototipo

Gaby Spark es la mascota de la asistente de NOVA (aprobada por Mario el 11-nov-2026). En este prototipo reemplaza a la figura humana anterior.

- **Componente:** `assets/gaby-spark.js`. Es SVG, CSS y JavaScript, sin librerías y sin imágenes.
- **Dónde aparece:** en el Inicio (`index.html`) y en la página de Gaby (`gaby.html`, figura y avatar del chat).
- **Estados:** `feliz`, `escuchando`, `pensando`, `hablando` y `sorprendida`. En el chat de muestra cambia sola: al escribir escucha, al enviar piensa, al responder habla y luego vuelve a feliz. Es solo visual: las respuestas siguen siendo fijas.
- **Accesibilidad:** se anuncia como «asistente de inteligencia artificial». Si el equipo pide reducir el movimiento, no se anima.
- **Seguridad:** la página prohíbe estilos en línea; el componente carga sus estilos con una hoja construida por código, que sí está permitida.
- **Piel 3D:** el componente acepta el atributo `piel` con la imagen del cuerpo aprobado. **Aquí no se usa**: el prototipo no lleva fotos y este repositorio es público. Se activa solo con autorización de Mario.
- **Pruebas:** `node --test test/prototipo.test.js` (dos pruebas nuevas de Gaby Spark).
- La función `gaby()` de `assets/ilustraciones.js` (figura anterior) ya no se usa en ninguna página; se deja sin tocar.
