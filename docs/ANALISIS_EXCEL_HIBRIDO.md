# ANÁLISIS: Excel de control → CRM híbrido (Control de Efectivo REAL)

> Fuente: sesión 20260906_220933 "Analizar estructura de Google Sheets" + descarga directa del
> Excel compartido (docs.google.com/spreadsheets/d/1PljHcxn4Zda9nmARhwSPRx0PfiSsjT2d11tysvdVXwI).
> Objetivo de Yoe: que la app haga lo que hace el Excel + lo que hace "Mi Negocio" (el .mxn que
> importamos con el botón Migración), y más. Estado de este doc: ANÁLISIS APROBADO PARA PLANTEAR,
> pendiente decisión de alcance por fases.

## 1. Estructura del Excel (tabla por tabla)

### Hoja "Registros Diarios" (todo manual, celdas amarillas editables)
| Tabla | Celdas | Qué hace | ¿CRM hoy? |
|---|---|---|---|
| Ventas Diarias | A3:I35 | Días 1-31 × 4 kioscos (MCH1, MCH2, M&R-1, M&R-2) × Efectivo/Transferencias + totales | ✅ automático (tickets POS por sede) |
| Salarios MCH / M&R | N3:V33 / N37:V79 | Nombre, negocio, fechas, días, 5%, ventas del corte, pagado efectivo (manual), fórmula, **Diff auditoría** | ✅ wages 5% + liquidación; falta vista Diff pagado-vs-fórmula |
| Compra de Divisas MCH/M&R | X3:AA57 / AB | Fecha, desc, divisa, **MN utilizada, tasa, cantidad comprada** | ✅ currency_purchases como ticket auditoría |
| Rebajas y Aumentos | AL4:AV35 | Producto, negocio, precio viejo→nuevo, diff, REBAJA/AUMENTO, totales por negocio | ❌ NO existe en CRM (gap) |
| Salidas de Transferencias | Y62:AA89 / AF | Día, desc, monto por negocio | ◐ parcial (gastos transfer) |
| Gastos por categoría | bloque BA+ | Trabajadora/negocio × categorías (casa, licencia, custodios, aduana, paquetería...) | ✅ expense_types |
| Entradas de Mercancía | A94:E140 / M143:Q190 | Compras/entradas por negocio | ✅ purchases + transfers |
| Mermas | N103:R133 | Día, negocio, desc, precio venta, cantidad, total | ✅ losses |
| **Entrega de Efectivo MCH/M&R** | Y94:AA122 / Y129:AA154 | Día, **monto, TIPO DE DIVISA (MN o USD)** — el dinero que sube del kiosco a la caja | ◐ el cierre de sesión manda a bolsa, pero **sin tipo de divisa explícito ni trazabilidad "entrega"** |

### Hoja "Control de Efectivo" (el corazón — datos actuales descargados)
Dos bloques gemelos lado a lado (**MCH** y **M&R**), cada uno con las 4 divisas:

| Bolsa | Saldo Anterior | Ingresos | Egresos | Saldo | Efectivo Real | Diff |
|---|---|---|---|---|---|---|
| MN | 261,650 | — | 43,000 | 218,650 | 261,650 | **43,000** ⚠️ |
| USD | 240 | — | — | 240 | 240 | — |
| EUR | — | — | — | — | — | — |
| Transferencias | 385,861 | — | — | 385,861 | 385,861 | — |

- **Saldo** = teórico (anterior + ingresos − egresos, calculado).
- **Efectivo Real** = lo que contás físicamente (manual, amarillo).
- **Diff** = la auditoría: por qué difiere (el ejemplo actual muestra diff MN 43,000 sin
  resolver = egreso no registrado; exactamente el bug que la app elimina).
- Filas extra: **Efectivo Entregado en USA** (ingreso externo) y **Salario Admin mes Anterior**
  (A11, se convierte en egreso al abrir el mes, redondeado a centenas).
- TOTALES MCH/R y M&R: totales consolidados de saldos.

### Hoja "Resumen y Análisis" (P&L mensual + control de inventario)
- Resumen Mensual MCH / M&R: Ventas, Gastos, Salarios, Inversión, Ganancias Parciales,
  Pago de Admin, **Ganancias, Rentabilidad** — columna USD a tasa **730** (referencia).
- **Ventas Posibles / Reporte de Inventario**: MCH1 3,587,600 · MCH2 3,209,000 ·
  Almacén 4,611,850 = **stock × precio de venta valorizado** ("ventas posibles"),
  con "Saldo según datos EXEL", Diferencia, OK → esto ES el "control de inventario"
  que Yoe dice que la app no tiene.

### Cierre de mes (Apps Script `reiniciarMes`, ya escrito en la otra sesión)
- Efectivo Real → Saldo Anterior del mes nuevo (por divisa, por negocio, MCH F3:F6 y M&R L3:L6).
- Salario Admin **redondeado a centenas** → A11.
- Inventario: M3:M5→F3:F5 (ventas posibles pasan a saldo anterior de inventario).
- Reset de todas las tablas operativas, fórmulas intactas.

## 2. Gap CRM vs Excel (para el híbrido)

| # | Gap | Fase | Esfuerzo |
|---|---|---|---|
| G1 | **Negocio M&R no existe** en la app (solo Almacén MCH, MCH1, MCH2). El Excel lleva 2 negocios: MCH y M&R, cada uno con kiosco(s)+almacén+su propio bloque de control de efectivo | A | medio-alto (crear sedes mr1/mr2/alm_mr con flag negocio MCH\|M&R) |
| G2 | Control de Efectivo **por negocio** (2 bloques lado a lado, como el Excel) filtrando movimientos por negocio de la sede de origen | A | medio |
| G3 | **Entrega de Efectivo** como movimiento de primera clase con tipo de divisa (kiosco→caja), visible en el feed | A | bajo-medio |
| G4 | **Efectivo Entregado en USA** (ingreso manual externo etiquetado) | A | bajo |
| G5 | **Salario Admin mes anterior** redondeado a centenas como egreso automático de apertura | A | bajo |
| G6 | **Auditoría Diff en salarios** (pagado efectivo vs fórmula, columna Diff del Excel) | A | bajo |
| G7 | **Rebajas/Aumentos de precio** con log auditado y totales por negocio | B | medio |
| G8 | **Inventario valorizado** ("Ventas Posibles"): stock × precio venta por sede, con conteo físico vs teórico | B | medio |
| G9 | **Resumen y Análisis**: P&L mensual (ventas, gastos, salarios, inversión, ganancias, rentabilidad) con tasa USD configurable (730) | C | medio |
| G10 | **Edición manual de datos históricos** (admin) con audit trail — Yoe: "cosas que se modifican manualmente, después vemos cómo" | D | medio |

## 3. Qué ya está alineado (no tocar)
- Bolsas MN/USD/EUR/Transferencias con saldo anterior auto-heredado ✓
- Conteo físico (cash_physical_counts) + Diff ✓ — mismo concepto que el Excel, pero en vivo
- Gastos híbridos (efectivo+transferencia desglosados) ✓
- Compras de divisas con MN salida/tasa/cantidad ✓ · Mermas ✓ · Salarios 5% ✓
- Redondeo a centenas en cierre ✓ · Devoluciones con auditoría ✓

## 4. La diferencia clave (filosofía híbrida)
El Excel es **carga diferida**: al final del día/semana escribís totales. La app es **en vivo**:
cada ticket ya alimenta ingresos/egresos por bolsa. El híbrido correcto NO es copiar el Excel,
es: (a) mismo vocabulario y mismas auditorías (Diff, entrega, divisa), (b) el Efectivo Real se
registro cuando quieras contar, y la app te dice el Diff al instante señalando qué movimientos
explican la diferencia, (c) el cierre de mes replica el Apps Script (pase de saldos + salario admin).

## 5. Orden propuesto de implementación
1. **Fase A (Control de Efectivo REAL)**: G1+G2 (negocios y doble bloque) → G3 (entregas con
   divisa) → G4, G5, G6 (USA, salario admin, diff salarios).
2. **Fase B**: G8 (ventas posibles / inventario valorizado) + G7 (rebajas/aumentos).
3. **Fase C**: G9 (Resumen y Análisis con tasa configurable).
4. **Fase D**: G10 (ediciones manuales auditadas).
