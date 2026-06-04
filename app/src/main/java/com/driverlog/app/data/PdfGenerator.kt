package com.driverlog.app.data

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Environment
import java.io.File
import java.io.FileOutputStream
import java.util.Calendar

object PdfGenerator {

    private const val PAGE_W = 595
    private const val PAGE_H = 842
    private const val M = 36f

    private val BLUE = Color.parseColor("#1A237E")
    private val BLUE_MED = Color.parseColor("#3949AB")
    private val STRIPE = Color.parseColor("#F3F4F9")
    private val SUMMARY_BG = Color.parseColor("#EEF2FF")

    // Columns: label → column width in points
    private val VIAJE_COLS = listOf(
        "#" to 22f, "Origen" to 82f, "Destino" to 82f, "KM" to 38f,
        "Tipo servicio" to 72f, "Salida" to 48f, "Llegada" to 48f,
        "Acop." to 42f, "T/C" to 42f
    )

    private val GUARDIA_COLS = listOf(
        "#" to 22f, "Tipo" to 65f, "Inicio" to 52f, "Fin" to 52f,
        "Horas" to 52f, "KM" to 48f, "Viático" to 52f, "Descripción" to 178f
    )

    fun generarPdf(context: Context, jornada: JornadaCompleta): File {
        val prefs = context.getSharedPreferences("cot_prefs", Context.MODE_PRIVATE)
        val nombre = prefs.getString("nombre", "") ?: ""
        val base   = prefs.getString("base",   "") ?: ""
        val tipo   = prefs.getString("tipo",   "") ?: ""
        val totales = LaudoCalculator.calcular(jornada)

        val doc = PdfDocument()
        val ctx = Ctx(doc)

        drawHeader(ctx, jornada, nombre, base, tipo)
        drawViajesSection(ctx, jornada.travels.filter {
            it.status != "cancelado" && it.origen != "Prueba" && it.destino != "Prueba"
        })
        if (jornada.guards.isNotEmpty()) drawGuardiasSection(ctx, jornada.guards)
        drawSummary(ctx, totales)
        ctx.finish()

        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS) ?: context.filesDir
        dir.mkdirs()
        val file = File(dir, "jornada_${jornada.orderNumber}.pdf")
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        return file
    }

    // ── Sections ──────────────────────────────────────────────────────────────

    private fun drawHeader(
        ctx: Ctx,
        jornada: JornadaCompleta,
        nombre: String,
        base: String,
        tipo: String
    ) {
        val c = ctx.canvas
        txt(c, "COT  —  PLANILLA DE JORNADA", M, ctx.y + 20f, p(BLUE, 20f, bold = true))
        ctx.y += 30f
        hLine(c, ctx.y, BLUE, 2f)
        ctx.y += 14f

        val col2 = M + (PAGE_W - 2 * M) / 2f
        val pL = p(Color.DKGRAY, 10f)
        val pV = p(Color.BLACK, 10f, bold = true)

        fun row(l1: String, v1: String, l2: String = "", v2: String = "") {
            txt(c, l1, M, ctx.y, pL)
            txt(c, v1, M + 58f, ctx.y, pV)
            if (l2.isNotEmpty()) {
                txt(c, l2, col2, ctx.y, pL)
                txt(c, v2, col2 + 62f, ctx.y, pV)
            }
            ctx.y += 16f
        }

        val cierreStr = jornada.closedAt?.let {
            val cal = Calendar.getInstance().apply { timeInMillis = it }
            "%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
        } ?: "—"

        row("Nombre:", nombre.ifEmpty { "—" }, "N° Orden:", jornada.orderNumber)
        row("Legajo:", jornada.legajo.ifEmpty { "—" }, "Fecha:", jornada.fecha)
        row("Base:", base.ifEmpty { jornada.baseInicio }, "Cierre:", cierreStr)
        row("Tipo:", tipo.replaceFirstChar { it.uppercase() }.ifEmpty { "—" })
        ctx.y += 8f
        hLine(c, ctx.y, Color.LTGRAY, 0.8f)
        ctx.y += 14f
    }

    private fun drawViajesSection(ctx: Ctx, viajes: List<Viaje>) {
        ctx.ensure(52f)
        txt(ctx.canvas, "VIAJES", M, ctx.y, p(BLUE, 13f, bold = true))
        ctx.y += 18f

        if (viajes.isEmpty()) {
            txt(ctx.canvas, "Sin viajes en esta jornada.", M + 8f, ctx.y, p(Color.GRAY, 10f))
            ctx.y += 20f
            return
        }

        // Determinar cuál viaje tiene T/C
        val tiposConTC = setOf("TURNO","SEMIDIRECTO","DIRECTO","DIRECTISIMO","EXPRESO","CONTRATADO")
        val viajesValidos = viajes.filter {
            it.status == "finalizado" &&
                    it.tipoServicio.uppercase().trim() in tiposConTC
        }
        val primerViajeConTC = viajesValidos.minByOrNull { it.inicioReal ?: it.inicioProgramado }

        ctx.ensure(22f)
        tableRow(ctx, VIAJE_COLS, null, isHeader = true)

        viajes.forEachIndexed { i, v ->
            ctx.ensure(18f)
            val km = (v.kmEmpresa.takeIf { it > 0 } ?: v.kmAuto).toString()
            val llegada = v.arrivalTime.takeIf { it.isNotEmpty() }
                ?: v.finReal?.let { ms ->
                    val cal = Calendar.getInstance().apply { timeInMillis = ms }
                    "%02d:%02d".format(cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
                } ?: "—"
            val tieneTC = primerViajeConTC?.id == v.id
            tableRow(ctx, VIAJE_COLS, listOf(
                "${i + 1}",
                v.origen.take(13),
                v.destino.take(13),
                km,
                v.tipoServicio.take(9),
                v.departureTime,
                llegada,
                if (v.acoplado) "Sí" else "No",
                if (tieneTC) "Sí" else "No"
            ), isHeader = false, stripe = i % 2 == 1)
        }
        ctx.y += 10f
    }

    private fun drawGuardiasSection(ctx: Ctx, guardias: List<Guardia>) {
        ctx.ensure(52f)
        txt(ctx.canvas, "GUARDIAS", M, ctx.y, p(BLUE, 13f, bold = true))
        ctx.y += 18f

        ctx.ensure(22f)
        tableRow(ctx, GUARDIA_COLS, null, isHeader = true)

        guardias.forEachIndexed { i, g ->
            ctx.ensure(18f)
            tableRow(ctx, GUARDIA_COLS, listOf(
                "${i + 1}",
                if (g.type == "especial") "Especial" else "Común",
                g.inicio,
                g.fin.ifEmpty { "—" },
                "%.1f h".format(g.hours),
                "%.0f".format(g.kmGuardia),
                if (g.viatico) "Sí" else "No",
                (g.descripcion ?: "—").take(22)
            ), isHeader = false, stripe = i % 2 == 1)
        }
        ctx.y += 10f
    }

    private fun drawSummary(ctx: Ctx, t: LaudoCalculator.Totales) {
        ctx.ensure(172f)
        val c = ctx.canvas

        txt(c, "RESUMEN DE JORNADA", M, ctx.y, p(BLUE, 13f, bold = true))
        ctx.y += 16f

        c.drawRect(M, ctx.y, (PAGE_W - M).toFloat(), ctx.y + 144f,
            Paint().apply { color = SUMMARY_BG })
        ctx.y += 14f

        val col2 = M + (PAGE_W - 2 * M) / 2f
        val pL = p(Color.DKGRAY, 10f)
        val pV = p(Color.BLACK, 10f, bold = true)

        fun row(l1: String, v1: String, l2: String = "", v2: String = "") {
            txt(c, l1, M + 8f, ctx.y, pL)
            txt(c, v1, M + 134f, ctx.y, pV)
            if (l2.isNotEmpty()) {
                txt(c, l2, col2 + 8f, ctx.y, pL)
                txt(c, v2, col2 + 134f, ctx.y, pV)
            }
            ctx.y += 18f
        }

        row(
            "KM Viajes:",    "%.1f km".format(t.kmViajes),
            "KM Guardias:", "%.1f km".format(t.kmGuardias)
        )
        row(
            "KM Tome/Cese:", "%.1f km".format(t.kmTomeCese),
            "KM Acoplados:", "%.1f km".format(t.kmAcoplados)
        )
        row("Viáticos:", "${t.viaticos} × \$455 = \$%.0f".format(t.viaticos * 455.0))

        hLine(c, ctx.y - 4f, Color.DKGRAY, 0.8f)
        ctx.y += 6f
        row("KM Total:", "%.1f km".format(t.kmTotal))

        txt(c, "MONTO TOTAL:", M + 8f, ctx.y, p(BLUE, 14f, bold = true))
        txt(c, "\$ %.2f".format(t.monto), M + 134f, ctx.y, p(BLUE, 14f, bold = true))
        ctx.y += 20f
    }

    // ── Table row ─────────────────────────────────────────────────────────────

    private fun tableRow(
        ctx: Ctx,
        cols: List<Pair<String, Float>>,
        values: List<String>?,
        isHeader: Boolean,
        stripe: Boolean = false
    ) {
        val c = ctx.canvas
        val rowH = if (isHeader) 20f else 16f
        val top = ctx.y - 13f

        c.drawRect(M, top, (PAGE_W - M).toFloat(), top + rowH, Paint().apply {
            color = when {
                isHeader -> BLUE_MED
                stripe   -> STRIPE
                else     -> Color.WHITE
            }
        })

        val paint = p(if (isHeader) Color.WHITE else Color.parseColor("#212121"), 9f, bold = isHeader)
        var x = M + 4f
        val labels = if (isHeader) cols.map { it.first } else values.orEmpty()
        cols.zip(labels).forEach { (col, label) ->
            txt(c, label, x, ctx.y, paint)
            x += col.second
        }
        ctx.y += rowH
    }

    // ── Primitives ────────────────────────────────────────────────────────────

    private fun txt(c: Canvas, s: String, x: Float, y: Float, paint: Paint) =
        c.drawText(s, x, y, paint)

    private fun hLine(c: Canvas, y: Float, color: Int, sw: Float) =
        c.drawLine(M, y, (PAGE_W - M).toFloat(), y,
            Paint().apply { this.color = color; strokeWidth = sw; isAntiAlias = true })

    private fun p(color: Int = Color.BLACK, textSize: Float = 10f, bold: Boolean = false) =
        Paint().apply {
            this.color = color
            this.textSize = textSize
            typeface = if (bold) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
            isAntiAlias = true
        }

    // ── Page context ──────────────────────────────────────────────────────────

    private class Ctx(val doc: PdfDocument) {
        var num = 0
        lateinit var page: PdfDocument.Page
        lateinit var canvas: Canvas
        var y = M

        init { newPage() }

        fun newPage() {
            if (num > 0) doc.finishPage(page)
            num++
            page = doc.startPage(PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, num).create())
            canvas = page.canvas
            y = M
        }

        fun ensure(h: Float) { if (y + h > PAGE_H - M) newPage() }
        fun finish() = doc.finishPage(page)
    }
}
