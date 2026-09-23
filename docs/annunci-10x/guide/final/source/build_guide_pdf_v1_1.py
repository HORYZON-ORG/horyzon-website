from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
REPO = Path(__file__).resolve().parents[5]
OUTPUT = ROOT / "output"
ASSETS = ROOT / "assets"

FONT_DIR = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/share/fonts"
FONT_REGULAR = FONT_DIR / "Ubuntu-R.ttf"
FONT_MEDIUM = FONT_DIR / "Ubuntu-M.ttf"
FONT_BOLD = FONT_DIR / "Ubuntu-B.ttf"
FONT_LIGHT = FONT_DIR / "Ubuntu-L.ttf"

W, H = A4
M = 54
SAFE_BOTTOM = 58

NIGHT = "#081521"
NIGHT_2 = "#102733"
INK = "#162932"
MUTED = "#52636A"
LINE = "#A8AEA7"
PAPER = "#F2EEE3"
PAPER_2 = "#E8E5DC"
GOLD = "#D9BF8F"
GOLD_DARK = "#755D39"
TEAL = "#628780"
WARN = "#C77C43"
BLOCK = "#7F3028"
WHITE = "#FFFFFF"
SOFT = "#F8F5EC"
SOFT_GREEN = "#EEF1E7"
SOFT_WARN = "#FFF2E4"


@dataclass(frozen=True)
class Check:
    number: int
    dimension: str
    label: str
    points: int = 5


RUBRIC: list[tuple[str, int, list[str]]] = [
    ("Identità del ruolo", 10, ["Titolo chiaro, specifico e riconoscibile", "Livello/perimetro del ruolo comprensibili"]),
    ("Lavoro e risultati", 15, ["Attività quotidiane concrete", "Contributo/risultato atteso osservabile", "Contesto operativo, collaborazione e interlocutori"]),
    ("Allineamento al ruolo", 20, ["Enfasi coerente con popolarità ruolo/azienda", "Rappresentazione fedele routine/misto/sfida", "Qualificazione e impegno rappresentati correttamente", "Linguaggio, competenze e strumenti coerenti con tecnicità"]),
    ("Requisiti", 10, ["Indispensabili distinti da preferenziali/apprendibili", "Requisiti pertinenti al lavoro reale"]),
    ("Offerta e condizioni", 20, ["Sede/modalità di lavoro chiare", "Rapporto, orari, turni/tempi pertinenti", "Compenso/fascia chiari quando disponibili/applicabili", "Ragioni concrete e verificate per scegliere l'offerta"]),
    ("Canale e formato", 10, ["Struttura appropriata al canale/formato", "Coerenza tra testo, campi e destinazione"]),
    ("Leggibilità", 10, ["Gerarchia e scansione leggibili", "Linguaggio concreto, preciso, senza ripetizioni inutili"]),
    ("Candidatura", 5, ["Invito alla candidatura e destinazione chiare"]),
]

CHECKS: list[Check] = []
for dim, _, labels in RUBRIC:
    for label in labels:
        CHECKS.append(Check(len(CHECKS) + 1, dim, label))


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("Ubuntu", str(FONT_REGULAR)))
    pdfmetrics.registerFont(TTFont("Ubuntu-M", str(FONT_MEDIUM)))
    pdfmetrics.registerFont(TTFont("Ubuntu-B", str(FONT_BOLD)))
    pdfmetrics.registerFont(TTFont("Ubuntu-L", str(FONT_LIGHT)))


def hex_to_rgb(value: str) -> tuple[float, float, float]:
    value = value.lstrip("#")
    return tuple(int(value[index : index + 2], 16) / 255 for index in (0, 2, 4))


def set_fill(c: canvas.Canvas, value: str) -> None:
    c.setFillColorRGB(*hex_to_rgb(value))


def set_stroke(c: canvas.Canvas, value: str) -> None:
    c.setStrokeColorRGB(*hex_to_rgb(value))


def text_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text: str, width: float, font: str, size: float) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if text_width(candidate, font, size) <= width:
                current = candidate
            else:
                lines.append(current)
                current = word
        lines.append(current)
    return lines


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    *,
    font: str = "Ubuntu",
    size: float = 9.7,
    leading: float = 13.2,
    color: str = INK,
    max_lines: int | None = None,
) -> float:
    set_fill(c, color)
    c.setFont(font, size)
    lines = wrap(text, width, font, size)
    if max_lines is not None:
        lines = lines[:max_lines]
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_label(c: canvas.Canvas, text: str, x: float, y: float, *, color: str = GOLD_DARK) -> None:
    set_fill(c, color)
    c.setFont("Ubuntu-B", 7.4)
    c.drawString(x, y, text.upper())


def draw_heading(c: canvas.Canvas, number: str, title: str, subtitle: str | None = None) -> float:
    draw_label(c, number, M, H - 70)
    set_fill(c, INK)
    c.setFont("Ubuntu-L", 28)
    y = H - 98
    for line in wrap(title, W - 2 * M - 20, "Ubuntu-L", 28):
        c.drawString(M, y, line)
        y -= 32
    if subtitle:
        y -= 3
        y = draw_text(c, subtitle, M, y, W - 2 * M - 24, size=10.1, leading=13.8, color=MUTED)
    set_stroke(c, GOLD)
    c.setLineWidth(0.9)
    c.line(M, y - 14, W - M, y - 14)
    return y - 36


def new_page(c: canvas.Canvas, page: int, total: int, *, dark: bool = False) -> None:
    set_fill(c, NIGHT if dark else PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    if page > 1:
        y = 28
        set_stroke(c, GOLD if dark else LINE)
        c.setLineWidth(0.35)
        c.line(M, y + 18, W - M, y + 18)
        set_fill(c, PAPER if dark else MUTED)
        c.setFont("Ubuntu", 7.2)
        c.drawString(M, y, "Annunci 10x - Metodo Horyzon")
        c.drawRightString(W - M, y, f"{page}/{total}")


def page(c: canvas.Canvas, page_num: int, total: int, number: str, title: str, subtitle: str | None = None) -> float:
    new_page(c, page_num, total)
    return draw_heading(c, number, title, subtitle)


def card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str,
    *,
    label: str | None = None,
    fill: str = SOFT,
    stroke: str = LINE,
    title_color: str = INK,
    body_color: str = MUTED,
) -> None:
    set_fill(c, fill)
    set_stroke(c, stroke)
    c.setLineWidth(0.65)
    c.roundRect(x, y - h, w, h, 5, fill=1, stroke=1)
    ty = y - 18
    if label:
        draw_label(c, label, x + 14, ty)
        ty -= 14
    set_fill(c, title_color)
    c.setFont("Ubuntu-M", 12.2)
    for line in wrap(title, w - 28, "Ubuntu-M", 12.2):
        c.drawString(x + 14, ty, line)
        ty -= 14.4
    ty -= 2
    draw_text(c, body, x + 14, ty, w - 28, size=8.5, leading=11.2, color=body_color)


def bullets(c: canvas.Canvas, items: Iterable[str], x: float, y: float, width: float, *, size: float = 9.3) -> float:
    for item in items:
        set_fill(c, GOLD_DARK)
        c.circle(x + 3, y + 3, 2.1, fill=1, stroke=0)
        y = draw_text(c, item, x + 14, y, width - 14, size=size, leading=size + 3.3, color=INK)
        y -= 4
    return y


def flow(c: canvas.Canvas, x: float, y: float, labels: list[str], *, dark: bool = False) -> None:
    box_w = 106
    box_h = 50
    gap = 19
    for idx, label in enumerate(labels):
        bx = x + idx * (box_w + gap)
        set_fill(c, NIGHT_2 if not dark else PAPER)
        set_stroke(c, GOLD)
        c.roundRect(bx, y - box_h, box_w, box_h, 6, fill=1, stroke=1)
        set_fill(c, PAPER if not dark else NIGHT)
        c.setFont("Ubuntu-B", 8.2)
        lines = wrap(label, box_w - 18, "Ubuntu-B", 8.2)
        c.drawCentredString(bx + box_w / 2, y - 21, lines[0])
        if len(lines) > 1:
            c.drawCentredString(bx + box_w / 2, y - 32, lines[1])
        if idx < len(labels) - 1:
            set_stroke(c, GOLD)
            c.line(bx + box_w + 4, y - 25, bx + box_w + gap - 5, y - 25)
            c.line(bx + box_w + gap - 5, y - 25, bx + box_w + gap - 11, y - 21)
            c.line(bx + box_w + gap - 5, y - 25, bx + box_w + gap - 11, y - 29)


def three_columns(c: canvas.Canvas, y: float, cols: list[tuple[str, str]], *, h: float = 150) -> None:
    col_w = (W - 2 * M - 24) / 3
    for i, (title, body) in enumerate(cols):
        card(c, M + i * (col_w + 12), y, col_w, h, title, body)


def matrix(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    set_stroke(c, LINE)
    c.setLineWidth(0.7)
    c.rect(x, y - h, w, h, fill=0, stroke=1)
    c.line(x + w / 2, y - h, x + w / 2, y)
    c.line(x, y - h / 2, x + w, y - h / 2)
    quadrants = [
        ("Ruolo popolare + azienda forte", "Dai più spazio a contributo, requisiti e selezione.", x + 12, y - 23),
        ("Ruolo popolare + azienda poco nota", "Rendi più comprensibili azienda e opportunità.", x + w / 2 + 12, y - 23),
        ("Ruolo meno popolare + azienda forte", "Valorizza offerta e contesto senza nascondere il lavoro.", x + 12, y - h / 2 - 23),
        ("Ruolo meno popolare + azienda poco nota", "Massima chiarezza su lavoro, condizioni e ragioni concrete.", x + w / 2 + 12, y - h / 2 - 23),
    ]
    for title, body, qx, qy in quadrants:
        draw_text(c, title, qx, qy, w / 2 - 24, font="Ubuntu-M", size=8.6, leading=10.5)
        draw_text(c, body, qx, qy - 34, w / 2 - 24, size=7.7, leading=10.2, color=MUTED)
    draw_label(c, "popolarità del ruolo", x + w / 2 - 45, y - h - 20)
    c.saveState()
    c.translate(x - 20, y - h / 2 - 48)
    c.rotate(90)
    draw_label(c, "attrattività dell'azienda", 0, 0)
    c.restoreState()


def check_explainer(c: canvas.Canvas, y: float, checks: list[Check]) -> float:
    for item in checks:
        row_h = 50
        set_fill(c, SOFT)
        set_stroke(c, LINE)
        c.roundRect(M, y - row_h, W - 2 * M, row_h - 6, 4, fill=1, stroke=1)
        draw_label(c, f"{item.number:02d} - {item.dimension}", M + 12, y - 18)
        draw_text(c, item.label, M + 12, y - 33, W - 2 * M - 88, font="Ubuntu-M", size=9.3, leading=11.5)
        set_fill(c, NIGHT_2)
        set_stroke(c, NIGHT_2)
        c.roundRect(W - M - 54, y - 34, 42, 20, 6, fill=1, stroke=1)
        set_fill(c, PAPER)
        c.setFont("Ubuntu-B", 8)
        c.drawCentredString(W - M - 33, y - 27, "5 pt")
        y -= row_h
    return y


def checkbox(c: canvas.Canvas, x: float, y: float, size: float = 12) -> None:
    set_stroke(c, MUTED)
    c.setLineWidth(0.7)
    c.rect(x, y, size, size, fill=0, stroke=1)


def checklist_row(c: canvas.Canvas, y: float, item: Check, *, row_h: float = 48, standalone: bool = False) -> float:
    x = M
    w = W - 2 * M
    set_fill(c, WHITE if standalone else SOFT)
    set_stroke(c, LINE)
    c.roundRect(x, y - row_h, w, row_h - 5, 4, fill=1, stroke=1)
    draw_label(c, f"{item.number:02d}", x + 10, y - 18)
    draw_text(c, item.label, x + 34, y - 17, w - 205, font="Ubuntu-M", size=8.9, leading=11.2, color=INK)
    labels = ["Sì", "In parte", "No", "N/D"]
    col_x = x + w - 164
    for label in labels:
        checkbox(c, col_x, y - 27, 11)
        set_fill(c, MUTED)
        c.setFont("Ubuntu", 6.8)
        c.drawCentredString(col_x + 5.5, y - 34, label)
        col_x += 42
    return y - row_h


def field_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, hint: str = "") -> None:
    set_fill(c, WHITE)
    set_stroke(c, LINE)
    c.roundRect(x, y - h, w, h, 4, fill=1, stroke=1)
    draw_label(c, title, x + 10, y - 15)
    if hint:
        draw_text(c, hint, x + 10, y - 30, w - 20, size=7.4, leading=9.5, color=MUTED)


def page_cover(c: canvas.Canvas, page_num: int, total: int) -> None:
    new_page(c, page_num, total, dark=True)
    c.bookmarkPage("cover")
    c.addOutlineEntry("Cover", "cover", level=0)
    set_fill(c, PAPER)
    c.setFont("Ubuntu-B", 11)
    c.drawString(M, H - 60, "HORYZON")
    set_stroke(c, GOLD)
    c.line(M, H - 75, W - M, H - 75)
    draw_label(c, "metodo horyzon", M, H - 150, color=GOLD)
    set_fill(c, PAPER)
    c.setFont("Ubuntu-L", 62)
    c.drawString(M, H - 226, "ANNUNCI")
    set_fill(c, GOLD)
    c.drawString(M, H - 292, "10x")
    draw_text(c, "La guida pratica per costruire annunci di lavoro partendo dal lavoro reale", M, H - 333, 360, font="Ubuntu", size=16, leading=22, color=PAPER)
    flow(c, M, H - 415, ["Lavoro reale", "Persona necessaria", "Strategia", "Annuncio"], dark=True)
    set_fill(c, GOLD)
    c.setFont("Ubuntu", 8.5)
    c.drawString(M, 72, "Versione 1.1 - release editoriale 09/2026")


def page_intro(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "00", "Introduzione e indice compatto")
    c.bookmarkPage("intro")
    c.addOutlineEntry("Introduzione", "intro", level=0)
    paragraph_bottom = draw_text(c, "Questa guida non insegna a scrivere più bello. Insegna a capire cosa deve esserci prima di scrivere: lavoro reale, persona necessaria, strategia e verifica.", M, y, 300, size=12.4, leading=17.4)
    card(c, M + 326, y, 160, 112, "Disclaimer metodologico", "Annunci 10x è una metodologia Horyzon per strutturare e verificare annunci. Non garantisce candidature o assunzioni. Le condizioni dichiarate devono essere reali.", fill=SOFT)
    y = min(paragraph_bottom, y - 112) - 28
    draw_label(c, "indice", M, y)
    y -= 24
    index = [
        ("03", "Perché molti annunci non funzionano"),
        ("04", "Il metodo Annunci 10x"),
        ("05-13", "Dalla strategia al Master"),
        ("14-18", "Punteggio, copertura e controllo finale"),
        ("19-21", "Casi professionali"),
        ("22-27", "Scheda, checklist, pubblicazione"),
        ("28", "Chiusura"),
    ]
    for p, label in index:
        set_stroke(c, LINE)
        c.line(M, y + 11, W - M, y + 11)
        set_fill(c, GOLD_DARK)
        c.setFont("Ubuntu-B", 12)
        c.drawString(M, y, p)
        set_fill(c, INK)
        c.setFont("Ubuntu-M", 12.3)
        c.drawString(M + 64, y, label)
        y -= 37


def page_why(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "01", "Perché molti annunci non funzionano", "Il problema nasce quando si parte dalle parole invece che dal lavoro.")
    card(c, M, y, 225, 150, "Partire dal copy", "Titolo, tono e formule arrivano prima dei fatti. Il testo può sembrare fluido, ma lascia aperte le domande decisive.", label="rischio")
    card(c, M + 262, y, 225, 150, "Partire dal lavoro", "Prima si chiariscono contributo, attività, vincoli, requisiti, offerta e candidatura. Poi si scrive.", label="metodo", fill=SOFT_GREEN)
    y -= 190
    bullets(c, [
        "Il ruolo non è riconoscibile o usa un titolo creativo.",
        "Le attività sono slogan, non lavoro osservabile.",
        "I requisiti sono gonfiati o mescolati.",
        "L'offerta promette senza prove concrete.",
        "La candidatura non è chiara o non è utilizzabile.",
    ], M, y, W - 2 * M)


def page_method(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "02", "Il metodo Annunci 10x")
    c.bookmarkPage("method")
    c.addOutlineEntry("Metodo", "method", level=0)
    flow(c, M, y - 4, ["Lavoro reale", "Persona necessaria", "Strategia", "Annuncio"])
    y -= 110
    three_columns(c, y, [
        ("Fatti", "Titolo, attività, sede, condizioni, requisiti e prove reali. Senza fatti, la comunicazione diventa decorazione."),
        ("Scelte", "Decidere cosa enfatizzare: routine, sfida, qualificazione, offerta, tecnicità, candidatura."),
        ("Verifica", "Punteggio, copertura e controllo finale restano distinti. Un annuncio può avere un punteggio alto e non essere pronto."),
    ], h=157)
    card(c, M, y - 196, W - 2 * M, 82, "Principio", "Una frase efficace non è automaticamente un fatto. Un fatto vero non è automaticamente una frase efficace.", fill=NIGHT_2, stroke=GOLD, title_color=PAPER, body_color=PAPER)


def page_result(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "03", "Parti dal risultato", "Attività e contributo non sono la stessa cosa.")
    card(c, M, y, 225, 145, "Attività", "Rispondere alle email, pulire ambienti, pubblicare contenuti, aprire ticket.", label="cosa fa")
    card(c, M + 262, y, 225, 145, "Risultato", "Richieste gestite con chiarezza, ambienti sicuri, contenuti regolari, problemi indirizzati bene.", label="cosa produce", fill=SOFT_GREEN)
    card(c, M, y - 186, W - 2 * M, 105, "Esercizio", "Completa la frase: se questa persona lavorasse bene per sei mesi, cosa sarebbe più ordinato, più sicuro, più veloce, più chiaro o più affidabile?", fill=SOFT)
    bullets(c, ["Un risultato può essere qualitativo, ma deve essere osservabile.", "L'annuncio deve spiegare perché quel lavoro conta.", "Se non riesci a definire il contributo, non è ancora un problema di copy."], M, y - 330, W - 2 * M)


def page_real_work(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "04", "Descrivi il lavoro vero", "Routine, misto e sfida non sono giudizi di valore.")
    three_columns(c, y, [
        ("Routine", "Ripetizione utile, standard, continuità, precisione, procedure. Da valorizzare senza nasconderla."),
        ("Misto", "Lavoro programmato più problemi imprevisti. Serve mostrare entrambe le parti."),
        ("Sfida", "Responsabilità, incertezza, autonomia, pressione o problemi nuovi. Da dichiarare con precisione."),
    ], h=154)
    card(c, M, y - 194, W - 2 * M, 135, "Caso - Addetto/a pulizie", "Esempio fittizio: il brief indica struttura sanitaria, turno mattina, procedure interne e affiancamento. Da questi fatti deriva un lavoro prevalentemente routinario, con qualificazione formabile e impegno fisico/di affidabilità da dichiarare.", label="esempio fittizio", fill=SOFT_GREEN)


def page_qdt(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "05", "Qualificazione, impegno e tecnicità")
    three_columns(c, y, [
        ("Qualificazione", "Quanto è selettivo l'ingresso? Titoli, esperienza, abilitazioni o formazione possibile."),
        ("Impegno", "Quanto il lavoro richiede in termini di tempo, responsabilità, fatica, pressione, attenzione o carico relazionale."),
        ("Tecnicità", "Quanto dipende da strumenti, procedure, norme, diagnosi o competenze specialistiche."),
    ], h=166)
    card(c, M, y - 207, W - 2 * M, 125, "Uso corretto", "Queste parole non giudicano il valore di un ruolo. Aiutano a decidere quanto dettaglio serve, quali requisiti vanno spiegati e quali difficoltà devono essere rese visibili senza trasformarle in difetti.", fill=SOFT_GREEN)


def page_requirements(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "06", "Smetti di chiedere tutto", "I requisiti forti sono collegati al lavoro reale.")
    three_columns(c, y, [
        ("Indispensabile", "Serve dal primo giorno. Senza questo elemento la persona non può svolgere il ruolo in modo accettabile."),
        ("Preferenziale", "Migliora la coerenza con il ruolo, ma non deve bloccare candidature valide."),
        ("Apprendibile", "Può essere sviluppato con formazione, affiancamento o tempo."),
    ], h=152)
    card(c, M, y - 190, W - 2 * M, 106, "Domanda utile", "Perché serve dal primo giorno? Se non sai rispondere collegando il requisito a un'attività o a un risultato, forse non è indispensabile.", fill=SOFT)
    card(c, M, y - 325, W - 2 * M, 86, "Nota", "Indispensabile, preferenziale e apprendibile corrispondono ai concetti tecnici Required, Preferred e Trainable. Da qui in poi la guida usa l'italiano.", fill=SOFT_WARN, stroke=WARN)


def page_attraction(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "07", "Attrarre vs selezionare", "Popolarità del ruolo e attrattività dell'azienda sono due assi diversi.")
    matrix(c, M + 42, y + 4, 405, 286)
    bullets(c, [
        "Le indicazioni dei quadranti orientano la comunicazione: non sono formule assolute.",
        "Quando un asse è sconosciuto, resta da verificare: non va trasformato in basso o alto per comodità.",
        "Se l'azienda è poco nota, servono prove concrete, non claim grandi.",
    ], M, y - 335, W - 2 * M)


def page_offer(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "08", "L'offerta concreta", "Le condizioni materiali non si compensano con tono promozionale.")
    card(c, M, y, 225, 150, "Vago", "Ambiente giovane e stimolante. Possibilità di crescita. Team dinamico.", label="da evitare", fill=SOFT_WARN, stroke=WARN)
    card(c, M + 262, y, 225, 150, "Concreto", "Esempio fittizio: team di 5 persone, affiancamento di 4 settimane, turno 6:00-10:00, sede Bologna.", label="meglio", fill=SOFT_GREEN)
    card(c, M, y - 190, W - 2 * M, 116, "Claim Check - verifica delle affermazioni", "Retribuzione, benefit, crescita, stabilità, flessibilità e strumenti devono essere dichiarati o confermati. Se un'affermazione non è supportata, confermala, rimuovila o sostituiscila con un fatto verificabile.", fill=NIGHT_2, stroke=GOLD, title_color=PAPER, body_color=PAPER)


def page_strategy(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "09", "Che cosa mettere più in evidenza?", "La strategia decide l'angolo candidato, non inventa fatti e non calcola un punteggio.")
    labels = ["Popolarità del ruolo", "Attrattività dell'azienda", "Natura del lavoro", "Qualificazione", "Impegno", "Tecnicità", "Offerta"]
    for idx, label in enumerate(labels):
        bx = M + (idx % 2) * 248
        by = y - (idx // 2) * 66
        card(c, bx, by, 230, 50, label, "bassa / media / alta / N/D", fill=SOFT)
    card(c, M, y - 290, W - 2 * M, 118, "Strategy mini-canvas", "Angolo candidato: perché una persona adatta dovrebbe interessarsi. Leve: cosa va enfatizzato. Rischi: cosa non promettere. Domande: cosa manca prima di pubblicare o generare una variante.", fill=SOFT_GREEN)


def page_master(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "10", "Come costruire il Master", "Il Master è la versione completa e di riferimento dell'annuncio.")
    items = ["Titolo", "Apertura", "Contesto", "Lavoro e risultati", "Requisiti", "Condizioni", "Motivi per candidarsi", "Candidatura"]
    for i, item in enumerate(items):
        yy = y - i * 46
        set_fill(c, NIGHT_2 if i == 0 else SOFT)
        set_stroke(c, GOLD if i == 0 else LINE)
        c.roundRect(M + 42, yy - 30, W - 2 * M - 84, 34, 5, fill=1, stroke=1)
        set_fill(c, PAPER if i == 0 else INK)
        c.setFont("Ubuntu-M", 9.8)
        c.drawString(M + 58, yy - 18, item)
    draw_text(c, "Le versioni per i diversi canali derivano dal Master e non possono cambiarne i fatti.", M, 88, W - 2 * M, size=10.3, leading=14, color=MUTED)


def page_channel(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "11", "Adatta al canale", "Una variante di canale cambia forma, non cambia i fatti.")
    flow(c, M + 43, y, ["Master", "Portale lavoro", "Post social", "Email"])
    card(c, M, y - 118, 235, 158, "Può cambiare", "Lunghezza, ordine, apertura, enfasi, campi, tono e livello di dettaglio.", label="variante")
    card(c, M + 252, y - 118, 235, 158, "Non può cambiare", "Retribuzione, sede, modalità, benefit, requisiti o promesse non presenti nel Master.", label="vincolo", fill=SOFT_WARN, stroke=WARN)
    card(c, M, y - 316, W - 2 * M, 80, "Regola", "La variante può invitare alla lettura completa. Non deve contenere promesse più forti del documento principale.", fill=SOFT_GREEN)


def page_rubric(c: canvas.Canvas, page_num: int, total: int, part: int, items: list[Check]) -> None:
    y = page(c, page_num, total, f"{11 + part:02d}", f"I 20 controlli - parte {part}", "8 dimensioni, 20 controlli, totale 100 punti. La rubrica spiega cosa verificare; la checklist serve a compilare.")
    if part == 1:
        c.bookmarkPage("rubric")
        c.addOutlineEntry("Punteggio e controlli", "rubric", level=0)
    check_explainer(c, y, items)
    if part == 3:
        card(c, M, 128, W - 2 * M, 76, "Valutazione manuale", "Sì = 5 punti. In parte = 2,5 punti. No = 0 punti. N/D = non valutabile. Una contraddizione materiale vale 0 e può bloccare la pubblicazione.", fill=NIGHT_2, stroke=GOLD, title_color=PAPER, body_color=PAPER)


def page_coverage(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "15", "N/D, copertura e punteggio", "Non normalizzare quando mancano informazioni.")
    values = [("57,5", "punti osservati"), ("20", "punti non valutabili"), ("57,5-77,5", "intervallo possibile"), ("80%", "copertura dell'analisi")]
    for i, (value, label) in enumerate(values):
        bx = M + (i % 2) * 248
        by = y - (i // 2) * 118
        set_fill(c, NIGHT_2 if i == 2 else SOFT)
        set_stroke(c, GOLD if i == 2 else LINE)
        c.roundRect(bx, by - 88, 225, 88, 6, fill=1, stroke=1)
        set_fill(c, PAPER if i == 2 else INK)
        c.setFont("Ubuntu-L", 29)
        c.drawString(bx + 16, by - 38, value)
        draw_label(c, label, bx + 16, by - 62, color=GOLD if i == 2 else MUTED)
    card(c, M, 168, W - 2 * M, 96, "Regola", "N/D non vale zero. Significa che il controllo non può essere valutato con le informazioni disponibili o non è applicabile. Riduce la copertura e genera un intervallo.", fill=SOFT_GREEN)


def page_gate(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "16", "Punteggio alto non significa pronto", "Punteggio e controllo prima della pubblicazione rispondono a domande diverse.")
    card(c, M, y, 150, 110, "Punteggio", "Quanto l'annuncio è completo e coerente secondo la rubrica.")
    card(c, M + 170, y, 150, 110, "Controllo", "Ci sono blocchi o verifiche prima della pubblicazione?", fill=SOFT_GREEN)
    card(c, M + 340, y, 148, 110, "Esempio", "95/100 + contraddizione materiale = Bloccato / non pubblicare ancora.", fill=SOFT_WARN, stroke=BLOCK)
    y -= 154
    statuses = [("Pronto", "nessun blocco rilevante", TEAL), ("Da verificare", "serve conferma su uno o più punti", WARN), ("Bloccato", "non pubblicare prima di correggere", BLOCK)]
    for i, (status, desc, color) in enumerate(statuses):
        by = y - i * 58
        set_fill(c, SOFT)
        set_stroke(c, LINE)
        c.roundRect(M, by - 38, W - 2 * M, 42, 5, fill=1, stroke=1)
        set_fill(c, color)
        c.rect(M + 12, by - 25, 10, 10, fill=1, stroke=0)
        draw_text(c, status, M + 34, by - 18, 150, font="Ubuntu-B", size=10, leading=12)
        draw_text(c, desc, M + 205, by - 18, 250, size=8.7, leading=11.2, color=MUTED)


def page_complete_case_a(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "17", "Caso completo - dal brief alla lettura", "Esempio fittizio: Customer Care B2B.")
    c.bookmarkPage("cases")
    c.addOutlineEntry("Casi e strumenti", "cases", level=0)
    card(c, M, y, W - 2 * M, 86, "Brief", "Società B2B con servizi tecnici. Richieste via email e telefono. La persona risponde, capisce il problema, apre ticket e coordina il passaggio ai tecnici. Sede Padova, full time, contratto da definire.", label="esempio fittizio")
    y -= 116
    three_columns(c, y, [
        ("Risultato", "Richieste raccolte in modo chiaro e indirizzate correttamente."),
        ("Lavoro reale", "Email, telefono, domande di chiarimento, apertura ticket, aggiornamenti."),
        ("Requisiti", "Comunicazione chiara, precisione, calma. Esperienza customer care preferenziale."),
    ], h=152)
    card(c, M, y - 190, W - 2 * M, 88, "Offerta / dati mancanti", "Sede e orario sono presenti. Contratto e retribuzione vanno chiariti prima della pubblicazione se richiesti dal canale o dalla policy aziendale.", fill=SOFT_WARN, stroke=WARN)


def page_complete_case_b(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "18", "Caso completo - dalla strategia alla verifica", "Il ragionamento deve restare visibile, non nascosto nel testo finale.")
    flow(c, M, y - 4, ["Brief", "Risultato", "Strategia", "Annuncio"])
    y -= 118
    card(c, M, y, W - 2 * M, 78, "Strategia", "Angolo candidato: persona precisa e comunicativa che vuole gestire richieste B2B con metodo, facendo da ponte tra clienti e tecnici.", fill=SOFT_GREEN)
    card(c, M, y - 104, W - 2 * M, 98, "Struttura dell'annuncio", "1. apertura sul ruolo e contributo; 2. cosa farai; 3. cosa serve; 4. condizioni; 5. candidatura. La struttura non promette competenze tecniche profonde, perché il brief non le richiede.", fill=SOFT)
    card(c, M, y - 228, W - 2 * M, 94, "Controllo finale", "Punti forti: ruolo riconoscibile, lavoro reale chiaro, requisiti pertinenti. Priorità: confermare contratto, fascia retributiva, modalità e processo di candidatura.", fill=NIGHT_2, stroke=GOLD, title_color=PAPER, body_color=PAPER)


def page_three_roles(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "19", "Tre ruoli, stesso metodo, annunci diversi")
    three_columns(c, y, [
        ("Addetto/a pulizie", "Esempio fittizio: turno mattina, struttura sanitaria, procedure interne. Lavoro routinario e apprendibile con supporto; impegno fisico e affidabilità da dichiarare."),
        ("Manutentore", "Esempio fittizio: impianti industriali, diagnosi guasti, schemi, reperibilità programmata. Lavoro misto con tecnicità giustificata dai fatti."),
        ("Social Media Specialist", "Esempio fittizio: calendario editoriale, copy, coordinamento, metriche base. Lavoro orientato a risultati, con attività ricorrenti e problemi creativi/operativi."),
    ], h=218)
    card(c, M, y - 255, W - 2 * M, 86, "Regola", "Prima si definiscono i fatti dell'esempio, poi si deriva la classificazione. Il titolo da solo non basta per decidere qualificazione, tecnicità o natura del lavoro.", fill=NIGHT_2, stroke=GOLD, title_color=PAPER, body_color=PAPER)


def page_sheet_a(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "20", "Scheda Annuncio 10x - parte 1", "Template compilabile: lascia spazio reale per ragionare.")
    c.bookmarkPage("sheet")
    c.addOutlineEntry("Scheda Annuncio 10x", "sheet", level=0)
    field_box(c, M, y, W - 2 * M, 62, "Ruolo", "Titolo esterno, area/reparto, livello o perimetro.")
    field_box(c, M, y - 82, W - 2 * M, 92, "Risultato principale", "Quale contributo osservabile deve produrre la persona?")
    field_box(c, M, y - 194, W - 2 * M, 128, "Attività", "Attività quotidiane, periodiche, strumenti, interlocutori, vincoli.")
    field_box(c, M, y - 342, W - 2 * M, 90, "Natura del lavoro", "Routine / misto / sfida. Che cosa una persona deve accettare serenamente?")


def page_sheet_b(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "21", "Scheda Annuncio 10x - parte 2", "Dai più spazio a requisiti, offerta e ragioni concrete.")
    field_box(c, M, y, W - 2 * M, 118, "Requisiti", "Indispensabile, preferenziale, apprendibile, disqualificante.")
    field_box(c, M, y - 140, W - 2 * M, 126, "Offerta / perché scegliere", "Sede, modalità, orario, contratto, compenso, formazione, benefit reali, prove concrete.")
    field_box(c, M, y - 288, (W - 2 * M - 12) / 2, 80, "Canale", "Dove sarà pubblicato?")
    field_box(c, M + (W - 2 * M + 12) / 2, y - 288, (W - 2 * M - 12) / 2, 80, "Candidatura", "Come candidarsi? Che cosa inviare?")


def page_checklist(c: canvas.Canvas, page_num: int, total: int, start: int, end: int, *, standalone: bool = False) -> None:
    title = f"Checklist compilabile - controlli {start}-{end}"
    y = page(c, page_num, total, "22" if start == 1 else "23", title, "Segna Sì, In parte, No o N/D. Le contraddizioni materiali vanno annotate a parte.")
    if start == 1:
        c.bookmarkPage("checklist")
        c.addOutlineEntry("Checklist", "checklist", level=0)
    for item in CHECKS[start - 1 : end]:
        y = checklist_row(c, y, item, row_h=51, standalone=standalone)


def page_publish(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "24", "Prima di pubblicare", "Il controllo finale protegge da errori materiali.")
    gates = [
        ("Contraddizione materiale", "Ruolo, sede, orario, contratto, modalità o condizioni non sono coerenti."),
        ("Affermazione non supportata", "Una promessa fattuale non è confermata o non ha prove sufficienti."),
        ("Dato critico mancante", "Manca una informazione necessaria per quel ruolo o per quel canale."),
        ("Candidatura non valida", "La persona non capisce come candidarsi o la destinazione non è utilizzabile."),
        ("Incoerenza di canale", "Master, variante, campi o destinazione raccontano fatti diversi."),
    ]
    for idx, (title, body) in enumerate(gates):
        yy = y - idx * 53
        set_fill(c, WHITE)
        set_stroke(c, LINE)
        c.roundRect(M, yy - 39, W - 2 * M, 42, 5, fill=1, stroke=1)
        set_fill(c, BLOCK if idx < 3 else WARN)
        c.rect(M + 12, yy - 24, 9, 9, fill=1, stroke=0)
        draw_text(c, title, M + 34, yy - 17, 138, font="Ubuntu-B", size=8.9, leading=11)
        draw_text(c, body, M + 184, yy - 17, W - M - 198, size=8, leading=10, color=MUTED)
    card(c, M, y - 304, W - 2 * M, 92, "Segnale separato", "Una contraddizione materiale non è una quinta colonna della checklist: è un avviso da trattare prima della pubblicazione, anche quando il punteggio complessivo è alto.", fill=SOFT_WARN, stroke=WARN)


def page_final_questions(c: canvas.Canvas, page_num: int, total: int) -> None:
    y = page(c, page_num, total, "25", "Domande finali", "Se una risposta è problematica, non risolvere con stile: risolvi con chiarezza, conferma o rimozione.")
    bullets(c, [
        "Quale informazione, se fosse falsa, creerebbe il problema più grande?",
        "Quale requisito sta restringendo inutilmente il bacino?",
        "Quale promessa non posso dimostrare?",
        "Quale parte del lavoro sto rendendo troppo bella o troppo vaga?",
        "Una persona adatta sa perché candidarsi?",
        "Una persona non adatta capisce che forse non è il ruolo giusto?",
    ], M, y, W - 2 * M, size=10)
    card(c, M, y - 245, W - 2 * M, 98, "Uso pratico", "Stampa la checklist, compila la scheda durante la raccolta informazioni e tieni separato il controllo di pubblicazione dal punteggio. Il metodo serve a rendere visibili le decisioni, non a sostituirle.", fill=SOFT_GREEN)


def page_close(c: canvas.Canvas, page_num: int, total: int) -> None:
    new_page(c, page_num, total, dark=True)
    c.bookmarkPage("close")
    c.addOutlineEntry("Chiusura", "close", level=0)
    draw_label(c, "chiusura", M, H - 92, color=GOLD)
    set_fill(c, PAPER)
    c.setFont("Ubuntu-L", 37)
    y = H - 148
    for line in wrap("Puoi applicare il metodo da solo.", 430, "Ubuntu-L", 37):
        c.drawString(M, y, line)
        y -= 42
    y -= 16
    y = draw_text(c, "Questa guida ti dà gli strumenti per chiarire il lavoro, definire ciò che conta davvero e verificare l'annuncio prima di pubblicarlo.", M, y, 404, size=14, leading=20, color=PAPER)
    y -= 20
    draw_text(c, "Annunci 10x nasce per applicare lo stesso metodo in modo guidato, dall'analisi alla costruzione dell'annuncio.", M, y, 404, size=14, leading=20, color=PAPER)
    set_fill(c, GOLD)
    c.setFont("Ubuntu", 8)
    c.drawString(M, 72, "(c) Horyzon - Versione 1.1")


def apply_metadata(c: canvas.Canvas, title_suffix: str) -> None:
    c.setTitle("Annunci 10x — Guida pratica" if title_suffix == "guide" else f"Annunci 10x - {title_suffix} v1.1")
    c.setAuthor("Horyzon")
    c.setSubject("Metodo Annunci 10x")
    c.setKeywords("Annunci 10x; Horyzon; Metodo Annunci 10x; Versione 1.1")


def build_guide() -> Path:
    total = 28
    path = OUTPUT / "Annunci_10x_Guida_v1.1.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    apply_metadata(c, "guide")
    pages: list[Callable[[canvas.Canvas, int, int], None]] = [
        page_cover,
        page_intro,
        page_why,
        page_method,
        page_result,
        page_real_work,
        page_qdt,
        page_requirements,
        page_attraction,
        page_offer,
        page_strategy,
        page_master,
        page_channel,
        lambda cc, p, t: page_rubric(cc, p, t, 1, CHECKS[0:7]),
        lambda cc, p, t: page_rubric(cc, p, t, 2, CHECKS[7:14]),
        lambda cc, p, t: page_rubric(cc, p, t, 3, CHECKS[14:20]),
        page_coverage,
        page_gate,
        page_complete_case_a,
        page_complete_case_b,
        page_three_roles,
        page_sheet_a,
        page_sheet_b,
        lambda cc, p, t: page_checklist(cc, p, t, 1, 10),
        lambda cc, p, t: page_checklist(cc, p, t, 11, 20),
        page_publish,
        page_final_questions,
        page_close,
    ]
    for number, fn in enumerate(pages, 1):
        fn(c, number, total)
        c.showPage()
    c.save()
    return path


def build_checklist() -> Path:
    total = 4
    path = OUTPUT / "Annunci_10x_Checklist_v1.1.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    apply_metadata(c, "Checklist")
    page_checklist(c, 1, total, 1, 7, standalone=True)
    c.showPage()
    page_checklist(c, 2, total, 8, 14, standalone=True)
    c.showPage()
    page_checklist(c, 3, total, 15, 20, standalone=True)
    c.showPage()
    page_publish(c, 4, total)
    c.showPage()
    c.save()
    return path


def build_sheet() -> Path:
    total = 2
    path = OUTPUT / "Annunci_10x_Scheda_v1.1.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    apply_metadata(c, "Scheda")
    page_sheet_a(c, 1, total)
    c.showPage()
    page_sheet_b(c, 2, total)
    c.showPage()
    c.save()
    return path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    register_fonts()
    outputs = [build_guide(), build_checklist(), build_sheet()]
    manifest = {
        "version": "v1.1",
        "sourceContent": ["guide-content-v1.1.md", "checklist-v1.1.md", "source/build_guide_pdf_v1_1.py"],
        "pageCount": {"guide": 28, "checklist": 4, "scheda": 2},
        "fonts": ["Ubuntu R/M/B/L from bundled Poppler fonts"],
        "palette": {"night": NIGHT, "paper": PAPER, "gold": GOLD, "teal": TEAL, "ink": INK},
        "preserves": {"dimensions": 8, "checks": 20, "totalPoints": 100, "scoreNormalization": False},
        "outputs": {path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)} for path in outputs},
    }
    (OUTPUT / "build-manifest-v1.1.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    for path in outputs:
        print(path)


if __name__ == "__main__":
    main()
