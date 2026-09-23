from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
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
M = 46

NIGHT = "#081521"
NIGHT_2 = "#102733"
INK = "#162932"
MUTED = "#52636A"
LINE = "#9CA8A2"
PAPER = "#F2EEE3"
PAPER_2 = "#E8E5DC"
GOLD = "#D9BF8F"
GOLD_DARK = "#755D39"
TEAL = "#628780"
GREEN = "#D7FF3F"
WARN = "#C77C43"
BLOCK = "#7F3028"
WHITE = "#FFFFFF"


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
    size: float = 10,
    leading: float = 14,
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


def draw_heading(c: canvas.Canvas, number: str, title: str, subtitle: str | None = None) -> float:
    set_fill(c, GOLD_DARK)
    c.setFont("Ubuntu-B", 8)
    c.drawString(M, H - 68, number.upper())
    set_fill(c, INK)
    c.setFont("Ubuntu-L", 29)
    y = H - 95
    for line in wrap(title, W - 2 * M - 40, "Ubuntu-L", 29):
        c.drawString(M, y, line)
        y -= 33
    if subtitle:
        y -= 4
        y = draw_text(c, subtitle, M, y, W - 2 * M - 60, size=10.5, leading=14, color=MUTED)
    set_stroke(c, GOLD)
    c.setLineWidth(1)
    c.line(M, y - 12, W - M, y - 12)
    return y - 34


def draw_footer(c: canvas.Canvas, page: int, total: int, dark: bool = False) -> None:
    if page == 1:
        return
    y = 25
    set_stroke(c, GOLD if dark else LINE)
    c.setLineWidth(0.35)
    c.line(M, y + 18, W - M, y + 18)
    set_fill(c, PAPER if dark else MUTED)
    c.setFont("Ubuntu", 7.2)
    c.drawString(M, y, "Annunci 10x - Metodo Horyzon")
    c.drawRightString(W - M, y, f"{page}/{total}")


def new_page(c: canvas.Canvas, page: int, total: int, dark: bool = False) -> None:
    set_fill(c, NIGHT if dark else PAPER)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    draw_footer(c, page, total, dark)


def draw_pill(c: canvas.Canvas, x: float, y: float, label: str, *, color: str = GOLD, text_color: str = NIGHT) -> None:
    c.setLineWidth(0.6)
    set_fill(c, color)
    set_stroke(c, color)
    tw = text_width(label, "Ubuntu-B", 7.5)
    c.roundRect(x, y - 11, tw + 18, 18, 6, fill=1, stroke=1)
    set_fill(c, text_color)
    c.setFont("Ubuntu-B", 7.5)
    c.drawString(x + 9, y - 5, label)


def draw_card(
    c: canvas.Canvas,
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: str,
    *,
    label: str | None = None,
    fill: str = "#F8F5EC",
    stroke: str = LINE,
    title_color: str = INK,
) -> None:
    set_fill(c, fill)
    set_stroke(c, stroke)
    c.setLineWidth(0.65)
    c.roundRect(x, y - h, w, h, 5, fill=1, stroke=1)
    ty = y - 18
    if label:
        set_fill(c, GOLD_DARK)
        c.setFont("Ubuntu-B", 7)
        c.drawString(x + 14, ty, label.upper())
        ty -= 14
    set_fill(c, title_color)
    c.setFont("Ubuntu-M", 13)
    for line in wrap(title, w - 28, "Ubuntu-M", 13):
        c.drawString(x + 14, ty, line)
        ty -= 15
    ty -= 3
    draw_text(c, body, x + 14, ty, w - 28, size=8.7, leading=11.4, color=MUTED)


def draw_bullets(c: canvas.Canvas, items: Iterable[str], x: float, y: float, width: float, *, size: float = 9.5) -> float:
    for item in items:
        set_fill(c, GOLD_DARK)
        c.circle(x + 3, y + 3, 2.1, fill=1, stroke=0)
        y = draw_text(c, item, x + 13, y, width - 13, size=size, leading=size + 3, color=INK)
        y -= 4
    return y


def draw_flow(c: canvas.Canvas, x: float, y: float, labels: list[str], *, dark: bool = False) -> None:
    box_w = 105
    box_h = 50
    gap = 21
    for idx, label in enumerate(labels):
        bx = x + idx * (box_w + gap)
        set_fill(c, NIGHT_2 if not dark else PAPER)
        set_stroke(c, GOLD)
        c.setLineWidth(1)
        c.roundRect(bx, y - box_h, box_w, box_h, 6, fill=1, stroke=1)
        set_fill(c, PAPER if not dark else NIGHT)
        c.setFont("Ubuntu-B", 8.5)
        for line in wrap(label, box_w - 18, "Ubuntu-B", 8.5):
            c.drawCentredString(bx + box_w / 2, y - 22, line)
            break
        if idx < len(labels) - 1:
            set_stroke(c, GOLD)
            c.line(bx + box_w + 4, y - 25, bx + box_w + gap - 5, y - 25)
            c.line(bx + box_w + gap - 5, y - 25, bx + box_w + gap - 11, y - 21)
            c.line(bx + box_w + gap - 5, y - 25, bx + box_w + gap - 11, y - 29)


def draw_matrix(c: canvas.Canvas, x: float, y: float, w: float, h: float) -> None:
    set_stroke(c, LINE)
    c.setLineWidth(0.7)
    c.rect(x, y - h, w, h, fill=0, stroke=1)
    c.line(x + w / 2, y - h, x + w / 2, y)
    c.line(x, y - h / 2, x + w, y - h / 2)
    labels = [
        ("Ruolo popolare\nazienda forte", x + 14, y - 24),
        ("Ruolo popolare\nazienda poco nota", x + w / 2 + 14, y - 24),
        ("Ruolo meno popolare\nazienda forte", x + 14, y - h / 2 - 24),
        ("Ruolo meno popolare\nazienda poco nota", x + w / 2 + 14, y - h / 2 - 24),
    ]
    for label, lx, ly in labels:
        draw_text(c, label, lx, ly, w / 2 - 28, font="Ubuntu-M", size=9, leading=11, color=INK)
    set_fill(c, GOLD_DARK)
    c.setFont("Ubuntu-B", 7)
    c.drawCentredString(x + w / 2, y - h - 18, "POPOLARITA DEL RUOLO")
    c.saveState()
    c.translate(x - 18, y - h / 2)
    c.rotate(90)
    c.drawCentredString(0, 0, "ATTRATTIVITA AZIENDA")
    c.restoreState()


def draw_three_columns(c: canvas.Canvas, x: float, y: float, cols: list[tuple[str, str]], *, h: float = 170) -> None:
    col_w = (W - 2 * M - 24) / 3
    for i, (title, body) in enumerate(cols):
        draw_card(c, x + i * (col_w + 12), y, col_w, h, title, body, fill="#F7F3EA")


def draw_check_row(c: canvas.Canvas, y: float, idx: int, label: str, x: float = M, w: float = W - 2 * M) -> float:
    set_stroke(c, "#C7C2B6")
    c.setLineWidth(0.35)
    c.line(x, y + 8, x + w, y + 8)
    set_fill(c, GOLD_DARK)
    c.setFont("Ubuntu-B", 7.5)
    c.drawString(x, y - 3, str(idx).zfill(2))
    draw_text(c, label, x + 24, y, w - 164, font="Ubuntu-M", size=8.5, leading=10, color=INK, max_lines=2)
    labels = ["si", "parte", "no", "N/D"]
    cx = x + w - 130
    for item in labels:
        set_stroke(c, LINE)
        c.rect(cx, y - 5, 8, 8, fill=0, stroke=1)
        set_fill(c, MUTED)
        c.setFont("Ubuntu", 6.7)
        c.drawString(cx + 12, y - 3, item)
        cx += 33
    return y - 21


def simple_page(c: canvas.Canvas, page: int, total: int, number: str, title: str, subtitle: str | None = None) -> float:
    new_page(c, page, total)
    return draw_heading(c, number, title, subtitle)


RUBRIC = [
    ("Identita del ruolo", 10, ["Titolo chiaro, specifico e riconoscibile", "Livello/perimetro del ruolo comprensibili"]),
    ("Lavoro e risultati", 15, ["Attivita quotidiane concrete", "Contributo/risultato atteso osservabile", "Contesto operativo, collaborazione e interlocutori"]),
    ("Allineamento al ruolo", 20, ["Enfasi coerente con popolarita ruolo/azienda", "Rappresentazione fedele challenge/routine", "Qualificazione e impegno rappresentati correttamente", "Linguaggio, competenze e strumenti coerenti con tecnicita"]),
    ("Requisiti", 10, ["Indispensabili distinti da preferenziali/apprendibili", "Requisiti pertinenti al lavoro reale"]),
    ("Offerta e condizioni", 20, ["Sede/modalita di lavoro chiare", "Rapporto, orari, turni/tempi pertinenti", "Compenso/fascia chiari quando disponibili/applicabili", "Ragioni concrete e verificate per scegliere l'offerta"]),
    ("Canale e formato", 10, ["Struttura appropriata al canale/formato", "Coerenza tra testo, campi e destinazione"]),
    ("Leggibilita", 10, ["Gerarchia e scansione leggibili", "Linguaggio concreto, preciso, senza ripetizioni inutili"]),
    ("Candidatura", 5, ["CTA e destinazione candidatura chiare"]),
]


def page_cover(c: canvas.Canvas, page: int, total: int) -> None:
    new_page(c, page, total, dark=True)
    c.bookmarkPage("cover")
    c.addOutlineEntry("Cover", "cover", level=0)
    set_fill(c, PAPER)
    c.setFont("Ubuntu-B", 11)
    c.drawString(M, H - 58, "HORYZON")
    set_stroke(c, GOLD)
    c.line(M, H - 72, W - M, H - 72)
    set_fill(c, GOLD)
    c.setFont("Ubuntu-B", 12)
    c.drawString(M, H - 150, "METODO HORYZON")
    set_fill(c, PAPER)
    c.setFont("Ubuntu-L", 64)
    c.drawString(M, H - 225, "ANNUNCI")
    set_fill(c, GOLD)
    c.drawString(M, H - 292, "10x")
    y = draw_text(
        c,
        "La guida pratica per costruire annunci di lavoro partendo dal lavoro reale",
        M,
        H - 334,
        360,
        font="Ubuntu",
        size=16,
        leading=22,
        color=PAPER,
    )
    draw_flow(c, M, y - 38, ["Lavoro reale", "Persona necessaria", "Strategia", "Annuncio"], dark=True)
    set_fill(c, GOLD)
    c.setFont("Ubuntu", 8.5)
    c.drawString(M, 70, "Versione 1.0 - release editoriale 09/2026")


def page_intro(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "00", "Introduzione e indice compatto")
    c.bookmarkPage("intro")
    c.addOutlineEntry("Introduzione", "intro", level=0)
    y = draw_text(
        c,
        "Questa guida non insegna a scrivere piu bello. Insegna a capire cosa deve esserci prima di scrivere: lavoro reale, persona necessaria, strategia e verifica.",
        M,
        y,
        305,
        size=13,
        leading=18,
    )
    draw_card(
        c,
        M + 330,
        y + 88,
        170,
        105,
        "Disclaimer metodologico",
        "Annunci 10x e una metodologia Horyzon per strutturare e verificare annunci. Non garantisce candidature o assunzioni. Le condizioni dichiarate devono essere reali; per temi legali serve consulenza specifica.",
        fill="#F7F3EA",
    )
    y -= 10
    index = [
        ("03", "Perche molti annunci non funzionano"),
        ("04", "Il metodo Annunci 10x"),
        ("05-13", "Dalla strategia al Master"),
        ("14-17", "Score, coverage e gate"),
        ("18-19", "Casi professionali"),
        ("20-23", "Scheda, checklist, pubblicazione"),
        ("24", "Chiusura"),
    ]
    set_fill(c, INK)
    c.setFont("Ubuntu-B", 9)
    c.drawString(M, y, "INDICE")
    y -= 24
    for p, label in index:
        set_stroke(c, LINE)
        c.line(M, y + 10, W - M, y + 10)
        set_fill(c, GOLD_DARK)
        c.setFont("Ubuntu-B", 12)
        c.drawString(M, y - 1, p)
        set_fill(c, INK)
        c.setFont("Ubuntu-M", 13)
        c.drawString(M + 62, y - 1, label)
        y -= 37


def page_why(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "01", "Perche molti annunci non funzionano", "Il problema nasce quando si parte dalle parole invece che dal lavoro.")
    draw_card(c, M, y, 230, 150, "Partire dal copy", "Titolo, tono e formule arrivano prima dei fatti. Il testo puo sembrare fluido, ma lascia aperte le domande decisive.", label="RISCHIO")
    draw_card(c, M + 270, y, 230, 150, "Partire dal lavoro", "Prima si chiariscono contributo, attivita, vincoli, requisiti, offerta e candidatura. Poi si scrive.", label="METODO", fill="#EEF1E7")
    y -= 190
    draw_bullets(
        c,
        [
            "Il ruolo non e riconoscibile o ha un titolo creativo.",
            "Le attivita sono slogan, non lavoro osservabile.",
            "I requisiti sono gonfiati o mescolati.",
            "L'offerta promette senza prove concrete.",
            "La candidatura non e chiara o non e utilizzabile.",
        ],
        M,
        y,
        W - 2 * M,
    )


def page_method(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "02", "Il metodo Annunci 10x")
    c.bookmarkPage("method")
    c.addOutlineEntry("Metodo", "method", level=0)
    draw_flow(c, M, y - 10, ["Lavoro reale", "Persona necessaria", "Strategia", "Annuncio"])
    y -= 118
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Fatti", "Titolo, attivita, sede, condizioni, requisiti e prove reali. Senza fatti, la comunicazione diventa decorazione."),
            ("Scelte", "Decidere cosa enfatizzare: routine, challenge, qualificazione, offerta, tecnico, candidatura."),
            ("Verifica", "Score, coverage e gate restano distinti. Un annuncio puo avere punteggio alto e non essere pronto."),
        ],
        h=154,
    )
    y -= 195
    draw_card(c, M, y, W - 2 * M, 70, "Principio", "Una frase efficace non e automaticamente un fatto. Un fatto vero non e automaticamente una frase efficace.", fill="#111F27", stroke=GOLD, title_color=PAPER)


def page_result(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "03", "Parti dal risultato", "Attivita e contributo non sono la stessa cosa.")
    draw_card(c, M, y, 230, 145, "Attivita", "Rispondere alle email, pulire ambienti, pubblicare contenuti, aprire ticket.", label="COSA FA")
    draw_card(c, M + 270, y, 230, 145, "Risultato", "Richieste gestite con chiarezza, ambienti sicuri, contenuti regolari, problemi indirizzati bene.", label="COSA PRODUCE", fill="#EEF1E7")
    y -= 185
    draw_card(c, M, y, W - 2 * M, 98, "Esercizio", "Completa la frase: se questa persona lavorasse bene per sei mesi, cosa sarebbe piu ordinato, piu sicuro, piu veloce, piu chiaro o piu affidabile?", fill="#F8F5EC")
    y -= 130
    draw_bullets(c, ["Un risultato puo essere qualitativo, ma deve essere osservabile.", "L'annuncio deve spiegare perche quel lavoro conta.", "Se non riesci a definire il contributo, non e ancora un problema di copy."], M, y, W - 2 * M)


def page_real_work(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "04", "Descrivi il lavoro vero", "Routine, mixed e challenge non sono giudizi di valore.")
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Routine", "Ripetizione utile, standard, continuita, precisione, procedure. Da valorizzare senza nasconderla."),
            ("Mixed", "Lavoro programmato piu problemi imprevisti. Serve mostrare entrambe le parti."),
            ("Challenge", "Responsabilita, incertezza, autonomia, pressione o problemi nuovi. Da dichiarare con precisione."),
        ],
        h=150,
    )
    y -= 188
    draw_card(c, M, y, W - 2 * M, 132, "Caso - Addetto/a pulizie", "Ruolo prevalentemente routinario, qualificazione formabile, impegno fisico e affidabilita da dichiarare. Non serve inventare sfide continue: il valore e nella continuita del servizio, nella cura degli spazi e nel rispetto delle procedure.", label="ESEMPIO FITTIZIO", fill="#EEF1E7")


def page_qdt(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "05", "Qualificazione, impegno e tecnicita")
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Qualification", "Quanto e selettivo l'ingresso? Titoli, esperienza, abilitazioni o formazione possibile."),
            ("Demand", "Quanto costa il ruolo in tempo, responsabilita, fatica, pressione o carico relazionale."),
            ("Technicality", "Quanto dipende da strumenti, procedure, norme, diagnosi o competenze specialistiche."),
        ],
        h=165,
    )
    y -= 205
    draw_card(c, M, y, W - 2 * M, 120, "Caso - Manutentore", "Lavoro misto: controlli programmati e guasti imprevisti. Qualification medio/alta, demand legato a responsabilita e tempi, technicality alta. Il testo deve parlare di impianti, diagnosi e perimetro, non solo di ambiente dinamico.", label="ESEMPIO FITTIZIO")


def page_requirements(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "06", "Smetti di chiedere tutto", "I requisiti forti sono collegati al lavoro reale.")
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Required", "Serve dal primo giorno. Senza questo elemento la persona non puo svolgere il ruolo in modo accettabile."),
            ("Preferred", "Migliora il fit, ma non deve bloccare candidature valide."),
            ("Trainable", "Puo essere appreso con formazione, affiancamento o tempo."),
        ],
        h=150,
    )
    y -= 188
    draw_card(c, M, y, W - 2 * M, 122, "Domanda utile", "Perche serve dal primo giorno? Se non sai rispondere collegando il requisito a un'attivita o a un risultato, forse non e indispensabile.", fill="#F8F5EC")
    y -= 150
    draw_card(c, M, y, W - 2 * M, 82, "Errore comune", "Usare almeno 5 anni di esperienza come scorciatoia quando il vero requisito e saper svolgere tre attivita specifiche.", fill="#FFF2E4", stroke=WARN)


def page_attract(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "07", "Attrarre vs selezionare", "Popolarita del ruolo e attrattivita dell'azienda sono due assi diversi.")
    draw_matrix(c, M + 55, y + 10, 385, 250)
    y -= 305
    draw_bullets(c, ["Lo storico candidature e un segnale, non una prova assoluta.", "UNKNOWN e valido: non va trasformato in basso o alto per comodita.", "Se l'azienda e poco nota, servono prove concrete, non claim grandi."], M, y, W - 2 * M)


def page_offer(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "08", "L'offerta concreta", "Le condizioni materiali non si compensano con tono promozionale.")
    draw_card(c, M, y, 230, 150, "Vago", "Ambiente giovane e stimolante. Possibilita di crescita. Team dinamico.", label="DA EVITARE", fill="#FFF2E4", stroke=WARN)
    draw_card(c, M + 270, y, 230, 150, "Concreto", "Team di 5 persone, affiancamento di 4 settimane, turno 6:00-10:00, sede Bologna.", label="MEGLIO", fill="#EEF1E7")
    y -= 190
    draw_card(c, M, y, W - 2 * M, 110, "Claim Check", "Retribuzione, benefit, crescita, stabilita, flessibilita e strumenti devono essere dichiarati o confermati. Se un claim non e supportato, confermalo, rimuovilo o sostituiscilo con un fatto verificabile.", fill="#111F27", stroke=GOLD, title_color=PAPER)


def page_strategy(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "09", "Cosa mettere in evidenza", "La strategia decide l'angolo candidato, non inventa fatti.")
    labels = [
        "Popolarita ruolo", "Attrattivita azienda", "Routine", "Challenge", "Qualification", "Demand", "Technicality", "Offerta"
    ]
    x = M
    for idx, label in enumerate(labels):
        bx = x + (idx % 4) * 126
        by = y - (idx // 4) * 74
        draw_card(c, bx, by, 112, 54, label, "bassa / media / alta / N-D", fill="#F8F5EC")
    y -= 185
    draw_card(c, M, y, W - 2 * M, 132, "Strategy mini-canvas", "Angolo candidato: perche una persona adatta dovrebbe interessarsi. Leve: cosa va enfatizzato. Rischi: cosa non promettere. Domande: cosa manca prima di pubblicare o generare una variante.", fill="#EEF1E7")


def page_master(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "10", "Come costruire il Master", "Il Master e la fonte di verita dell'annuncio.")
    items = ["Titolo", "Apertura", "Contesto", "Lavoro e risultati", "Requisiti", "Condizioni", "Motivi per candidarsi", "Candidatura"]
    x = M + 40
    for i, item in enumerate(items):
        yy = y - i * 48
        set_fill(c, NIGHT_2 if i == 0 else "#F8F5EC")
        set_stroke(c, GOLD if i == 0 else LINE)
        c.roundRect(x, yy - 30, 420, 34, 5, fill=1, stroke=1)
        set_fill(c, PAPER if i == 0 else INK)
        c.setFont("Ubuntu-M", 10)
        c.drawString(x + 16, yy - 18, item)
    draw_text(c, "Non tutte le sezioni hanno lo stesso peso in ogni canale, ma nessuna variante puo aggiungere fatti nuovi rispetto al Master.", M, 88, W - 2 * M, size=10.5, leading=14, color=MUTED)


def page_channel(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "11", "Adatta al canale", "Una variante cambia forma, non cambia i fatti.")
    draw_flow(c, M + 48, y, ["Master", "Portale lavoro", "Post social", "Email"], dark=False)
    y -= 118
    draw_card(c, M, y, 240, 160, "Puo cambiare", "Lunghezza, ordine, apertura, enfasi, campi, tono e livello di dettaglio.", label="VARIANTE")
    draw_card(c, M + 265, y, 240, 160, "Non puo cambiare", "Retribuzione, sede, modalita, benefit, requisiti o promesse non presenti nel Master.", label="VINCOLO", fill="#FFF2E4", stroke=WARN)
    y -= 200
    draw_card(c, M, y, W - 2 * M, 80, "Teaser != Master", "Un teaser puo invitare alla lettura completa. Non deve contenere promesse piu forti del documento principale.", fill="#EEF1E7")


def page_rubric(c: canvas.Canvas, page: int, total: int, part: int) -> None:
    y = simple_page(c, page, total, "12" if part == 1 else "13", "I 20 controlli - parte 1" if part == 1 else "I 20 controlli - parte 2", "8 dimensioni, 20 controlli, totale 100 punti.")
    c.bookmarkPage("rubric1" if part == 1 else "rubric2")
    if part == 1:
        c.addOutlineEntry("Score e controlli", "rubric1", level=0)
    dims = RUBRIC[:4] if part == 1 else RUBRIC[4:]
    idx = 1 if part == 1 else 12
    for title, points, checks in dims:
        set_fill(c, GOLD_DARK)
        c.setFont("Ubuntu-B", 8)
        c.drawString(M, y, f"{title.upper()} - {points} punti")
        y -= 18
        for check in checks:
            y = draw_check_row(c, y, idx, check)
            idx += 1
        y -= 10
    if part == 2:
        draw_card(c, M, 132, W - 2 * M, 82, "Punteggio", "PASS = 5. PARTIAL = 2,5. MISSING = 0. CONFLICT = 0 + segnale. N/D = non valutabile, non zero.", fill="#111F27", stroke=GOLD, title_color=PAPER)


def page_coverage(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "14", "N/D, coverage e score", "Non normalizzare quando mancano informazioni.")
    x = M + 30
    values = [("57,5", "punti osservati"), ("20", "punti non valutabili"), ("57,5-77,5", "intervallo"), ("80%", "coverage")]
    for i, (value, label) in enumerate(values):
        bx = x + (i % 2) * 245
        by = y - (i // 2) * 120
        set_fill(c, NIGHT_2 if i == 2 else "#F8F5EC")
        set_stroke(c, GOLD if i == 2 else LINE)
        c.roundRect(bx, by - 88, 210, 88, 6, fill=1, stroke=1)
        set_fill(c, PAPER if i == 2 else INK)
        c.setFont("Ubuntu-L", 31)
        c.drawString(bx + 16, by - 38, value)
        set_fill(c, GOLD if i == 2 else MUTED)
        c.setFont("Ubuntu-B", 7.5)
        c.drawString(bx + 16, by - 62, label.upper())
    draw_card(c, M, 170, W - 2 * M, 96, "Regola", "N/D non vale zero. Significa che il controllo non puo essere valutato con le informazioni disponibili o non e applicabile. Riduce la copertura e genera un intervallo.", fill="#EEF1E7")


def page_gate(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "15", "Score alto non significa pronto", "Score e Publication Gate rispondono a domande diverse.")
    draw_card(c, M, y, 150, 110, "Score", "Quanto l'annuncio e completo e coerente secondo la rubrica.", fill="#F8F5EC")
    draw_card(c, M + 180, y, 150, 110, "Gate", "Ci sono blocchi o verifiche prima della pubblicazione?", fill="#EEF1E7")
    draw_card(c, M + 360, y, 145, 110, "Esempio", "95/100 + contraddizione materiale = BLOCKED", fill="#FFF2E4", stroke=BLOCK)
    y -= 155
    gates = [("READY", "nessun blocco"), ("NEEDS VERIFICATION", "serve conferma"), ("BLOCKED", "non pubblicare")]
    for i, (status, desc) in enumerate(gates):
        by = y - i * 58
        set_fill(c, "#F8F5EC")
        set_stroke(c, LINE)
        c.roundRect(M, by - 38, W - 2 * M, 42, 5, fill=1, stroke=1)
        set_fill(c, [TEAL, WARN, BLOCK][i])
        c.rect(M + 12, by - 25, 10, 10, fill=1, stroke=0)
        set_fill(c, INK)
        c.setFont("Ubuntu-B", 10)
        c.drawString(M + 34, by - 20, status)
        set_fill(c, MUTED)
        c.setFont("Ubuntu", 9)
        c.drawString(M + 210, by - 20, desc)


def page_complete_case(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "16", "Caso completo", "Esempio fittizio: Customer Care B2B.")
    c.bookmarkPage("cases")
    c.addOutlineEntry("Casi e strumenti", "cases", level=0)
    draw_card(c, M, y, W - 2 * M, 84, "Brief", "Customer Care B2B: richieste via email e telefono, apertura ticket, coordinamento con tecnici. Sede Padova, full time, contratto da definire.", label="ESEMPIO FITTIZIO")
    y -= 116
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Strategia", "Persona precisa e comunicativa, ponte tra clienti e tecnici."),
            ("Struttura", "Ruolo, cosa farai, cosa serve, condizioni, candidatura."),
            ("Priorita", "Confermare contratto, fascia, modalita e processo."),
        ],
        h=138,
    )
    y -= 174
    draw_card(c, M, y, W - 2 * M, 92, "Principio", "Il caso non serve a mostrare una correzione magica. Serve a far vedere come il brief diventa scheda, strategia e struttura dell'annuncio.", fill="#EEF1E7")


def page_three_roles(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "17", "Tre ruoli, stesso metodo, annunci diversi")
    draw_three_columns(
        c,
        M,
        y,
        [
            ("Addetto/a pulizie", "Routine alta, qualification formabile, offerta centrata su orari, sede, procedure e supporto."),
            ("Manutentore", "Mixed work, technicality alta, attenzione a diagnosi, impianti, reperibilita e responsabilita."),
            ("Social Media Specialist", "Role popularity alta, challenge creativa e operativa, metriche e canali da chiarire."),
        ],
        h=190,
    )
    draw_card(c, M, y - 228, W - 2 * M, 92, "Messaggio", "Stesso metodo non significa stesso annuncio. Cambiano lavoro reale, profilo, offerta, canale e rischi.", fill="#111F27", stroke=GOLD, title_color=PAPER)


def page_sheet(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "18", "Scheda Annuncio 10x", "Template compilabile: usa poco testo e tanto spazio.")
    c.bookmarkPage("sheet")
    c.addOutlineEntry("Scheda Annuncio 10x", "sheet", level=0)
    fields = ["Ruolo", "Risultato", "Attivita", "Autonomia", "Interlocutori", "Routine / imprevisti", "Indispensabili", "Preferenziali", "Apprendibili", "Sede / modalita", "Contratto / orari", "Compenso", "Formazione / benefit", "Perche scegliere", "Canale", "CTA"]
    col_w = (W - 2 * M - 12) / 2
    for i, field in enumerate(fields):
        bx = M + (i % 2) * (col_w + 12)
        by = y - (i // 2) * 55
        set_fill(c, "#FCFAF5")
        set_stroke(c, LINE)
        c.roundRect(bx, by - 43, col_w, 43, 4, fill=1, stroke=1)
        set_fill(c, GOLD_DARK)
        c.setFont("Ubuntu-B", 7)
        c.drawString(bx + 9, by - 13, field.upper())


def page_checklist(c: canvas.Canvas, page: int, total: int, start: int, end: int) -> None:
    title = "Checklist rapida - controlli 1-10" if start == 1 else "Checklist rapida - controlli 11-20"
    y = simple_page(c, page, total, "19" if start == 1 else "20", title, "[ ] si   [ ] in parte   [ ] no   [ ] N/D")
    if start == 1:
        c.bookmarkPage("checklist")
        c.addOutlineEntry("Checklist", "checklist", level=0)
    checks = [check for _, _, dim_checks in RUBRIC for check in dim_checks]
    for idx in range(start, end + 1):
        y = draw_check_row(c, y, idx, checks[idx - 1])


def page_publish(c: canvas.Canvas, page: int, total: int) -> None:
    y = simple_page(c, page, total, "21", "Prima di pubblicare", "Il controllo finale protegge da errori materiali.")
    gates = [
        ("Contraddizione materiale", "Ruolo, sede, orario, contratto, modalita o condizioni non sono coerenti."),
        ("Claim non supportato", "Una promessa fattuale non e confermata o non ha prove sufficienti."),
        ("Dato critico mancante", "Manca una informazione necessaria per quel ruolo o per quel canale."),
        ("Candidatura non valida", "La persona non capisce come candidarsi o la destinazione non e utilizzabile."),
        ("Incoerenza di canale", "Master, variante, campi o destinazione raccontano fatti diversi."),
    ]
    for idx, (title, body) in enumerate(gates):
        yy = y - idx * 52
        set_fill(c, "#FCFAF5")
        set_stroke(c, LINE)
        c.roundRect(M, yy - 38, W - 2 * M, 41, 5, fill=1, stroke=1)
        set_fill(c, BLOCK if idx < 3 else WARN)
        c.rect(M + 12, yy - 23, 9, 9, fill=1, stroke=0)
        set_fill(c, INK)
        c.setFont("Ubuntu-B", 9.3)
        c.drawString(M + 34, yy - 18, title)
        set_fill(c, MUTED)
        c.setFont("Ubuntu", 8.2)
        c.drawString(M + 178, yy - 18, body)
    y -= 300
    draw_card(c, M, y, W - 2 * M, 92, "Domande finali", "Quale promessa non posso dimostrare? Quale requisito restringe inutilmente il bacino? Una persona adatta sa perche candidarsi? Una persona non adatta capisce che forse non e il ruolo giusto?", fill="#EEF1E7")


def page_close(c: canvas.Canvas, page: int, total: int) -> None:
    new_page(c, page, total, dark=True)
    c.bookmarkPage("close")
    c.addOutlineEntry("Chiusura", "close", level=0)
    set_fill(c, GOLD)
    c.setFont("Ubuntu-B", 10)
    c.drawString(M, H - 90, "CHIUSURA")
    set_fill(c, PAPER)
    c.setFont("Ubuntu-L", 38)
    y = H - 145
    for line in wrap("Puoi applicare il metodo da solo.", 420, "Ubuntu-L", 38):
        c.drawString(M, y, line)
        y -= 43
    y -= 16
    y = draw_text(c, "Se vuoi, Annunci 10x puo analizzare il tuo annuncio o costruirlo insieme a te a partire dalle informazioni sul ruolo.", M, y, 390, size=14, leading=20, color=PAPER)
    draw_card(c, M, y - 30, 360, 82, "[CTA ANNUNCI 10x — DA INSERIRE AL LANCIO]", "Placeholder commerciale futuro. Nessuna URL pubblica definitiva in questa versione.", fill="#F8F5EC", stroke=GOLD)
    set_fill(c, GOLD)
    c.setFont("Ubuntu", 8)
    c.drawString(M, 70, "(c) Horyzon - v1")


def build_guide() -> Path:
    total = 24
    path = OUTPUT / "Annunci_10x_Guida_v1.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Annunci 10x — Guida pratica")
    c.setAuthor("Horyzon")
    c.setSubject("Metodo Annunci 10x")
    pages: list[Callable[[canvas.Canvas, int, int], None]] = [
        page_cover,
        page_intro,
        page_why,
        page_method,
        page_result,
        page_real_work,
        page_qdt,
        page_requirements,
        page_attract,
        page_offer,
        page_strategy,
        page_master,
        page_channel,
        lambda cc, p, t: page_rubric(cc, p, t, 1),
        lambda cc, p, t: page_rubric(cc, p, t, 2),
        page_coverage,
        page_gate,
        page_complete_case,
        page_three_roles,
        page_sheet,
        lambda cc, p, t: page_checklist(cc, p, t, 1, 10),
        lambda cc, p, t: page_checklist(cc, p, t, 11, 20),
        page_publish,
        page_close,
    ]
    for number, fn in enumerate(pages, 1):
        fn(c, number, total)
        c.showPage()
    c.save()
    return path


def build_checklist() -> Path:
    path = OUTPUT / "Annunci_10x_Checklist_v1.pdf"
    total = 3
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Annunci 10x - Checklist v1")
    c.setAuthor("Horyzon")
    c.setSubject("Checklist Annunci 10x")
    page_checklist(c, 1, total, 1, 10)
    c.showPage()
    page_checklist(c, 2, total, 11, 20)
    c.showPage()
    page_publish(c, 3, total)
    c.showPage()
    c.save()
    return path


def build_sheet() -> Path:
    path = OUTPUT / "Annunci_10x_Scheda_v1.pdf"
    c = canvas.Canvas(str(path), pagesize=A4)
    c.setTitle("Annunci 10x - Scheda v1")
    c.setAuthor("Horyzon")
    c.setSubject("Scheda Annuncio 10x")
    page_sheet(c, 1, 1)
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
        "version": "v1",
        "sourceContent": ["guide-content-v1.md", "checklist-v1.md"],
        "pageCount": {"guide": 24, "checklist": 3, "scheda": 1},
        "fonts": ["Ubuntu R/M/B/L from bundled Poppler fonts"],
        "palette": {"night": NIGHT, "paper": PAPER, "gold": GOLD, "teal": TEAL, "ink": INK},
        "outputs": {path.name: {"bytes": path.stat().st_size, "sha256": sha256(path)} for path in outputs},
    }
    (OUTPUT / "build-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    for path in outputs:
        print(path)


if __name__ == "__main__":
    main()
