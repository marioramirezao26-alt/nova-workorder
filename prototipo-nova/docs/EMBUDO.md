# Propuesta de embudo: redes → página de campaña → producto → Gaby → compra

**Solo es un documento.** No se crea, no se programa y no se reactiva ningún anuncio, y las 36 publicaciones anteriores
siguen detenidas. Cualquier anuncio que gaste plata necesita el «1. Sí» de Mario, como siempre.

## El recorrido

```
Redes (orgánico o anuncio)  →  Página de campaña  →  Ficha del producto  →  Gaby IA  →  Compra
       Luna / Mario                tienda/<campaña>       producto.html          gaby.html      (etapa 4)
```

| Paso | Qué ve la persona | Qué tiene que lograr | Qué se mide (cuando exista) | Qué falta para hacerlo real |
|---|---|---|---|---|
| 1. Redes | Un video o imagen de un producto o categoría | Que toque el enlace | Clics por publicación (UTM) | Productos reales con proveedor; la regla de avisar cuando el video tiene avatar de IA |
| 2. Página de campaña | Una sola categoría o colección, con el mismo diseño del prototipo | Que entre a una ficha | Visitas → clics a ficha | Ruta propia (`PLAN-MIGRACION.md`, etapa 3) |
| 3. Ficha | Producto, precio, condiciones | Que agregue al carrito o pregunte | Agregados al carrito, preguntas a Gaby | Precios, inventario, envío y garantía **validados** |
| 4. Gaby IA | Respuestas sobre ese producto | Resolver dudas sin prometer lo que no hay | Conversaciones que terminan en carrito | NOVA Commerce AI (`INTEGRACION-COMMERCE-AI.md`); respuestas revisadas |
| 5. Compra | Pago y confirmación | Pagar | Pedidos pagados | Medios de pago, quién vende, facturación, devoluciones (decisiones de Mario) |

## Reglas que el embudo tiene que respetar
- Publicar en redes: los agentes publican solos lo que pase `revisar_reglas.py`; nunca entre 8:00 p. m. y 8:00 a. m.
- Anuncios: se pueden **crear en pausa**; activarlos, cambiar presupuesto o pausarlos se propone a Mario.
- Gaby: siempre admite que es una IA; nunca escribe primero por WhatsApp; respeta el horario de la Ley 2300 y a quien dijo
  que no.
- WhatsApp de NOVA: 321 392 7697. Nunca el 310.
- Nada de precios, envíos, «compra protegida» ni «24/7» sin validar (`AFIRMACIONES-NO-VALIDADAS.md`).
- Datos personales: Ley 1581. La analítica del embudo se cuenta sin guardar datos de la persona.

## Medición propuesta (sin construir)
- Enlaces de redes con `utm_source`, `utm_campaign` y `utm_content`, como ya hace la página para «Empieza gratis».
- Contadores por paso, sin cookies ni datos personales, siguiendo el contador de visitas que ya existe (`/api/public/visit`).
- Una tabla corta para Leo con la tasa de paso a paso, por campaña.

## Decisiones que necesita Mario antes de pasar de documento a trabajo
1. ¿Qué productos y proveedores reales van primero?
2. ¿Quién envía, a dónde y a qué costo?
3. ¿Qué medio de pago?
4. ¿Qué garantía y política de devoluciones?
5. ¿La tienda vende como NOVA (quién vende, NIT, dirección para la Ley 1480)?
