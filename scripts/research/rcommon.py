"""Shared paths and session rules for the research pilot (EMMA-side, read-only copy of Moonshot data)."""
import csv, json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "research", "source", "moonshot")
RES = os.path.join(ROOT, "research")
OUT = os.path.join(RES, "out")
IDS = os.path.join(ROOT, "merge", "ids")
# local index per listing venue (Moonshot's v0 used the same family for London)
BENCH = {"XLON:AIM": ("^FTAI", "FTSE AIM All-Share"), "XLON:MAIN": ("^FTAS", "FTSE All-Share"),
         "XSTO": ("^OMXSPI", "OMX Stockholm All-Share"), "SSME": ("^OMXSPI", "OMX Stockholm All-Share"),
         "MERK": ("OSEBX.OL", "Oslo Benchmark Index"), "XOSL": ("OSEBX.OL", "Oslo Benchmark Index"),
         "XTSE": ("^GSPTSE", "S&P/TSX Composite"), "XASX": ("^AXSO", "S&P/ASX Small Ordinaries")}
# regular session (local exchange time)
SESSION = {"XLON": ("Europe/London", "08:00", "16:30"), "XSTO": ("Europe/Stockholm", "09:00", "17:30"),
           "SSME": ("Europe/Stockholm", "09:00", "17:30"), "MERK": ("Europe/Oslo", "09:00", "16:20"),
           "XOSL": ("Europe/Oslo", "09:00", "16:20"), "XTSE": ("America/Toronto", "09:30", "16:00"),
           "XASX": ("Australia/Sydney", "10:00", "16:00")}
def rcsv(p): return list(csv.DictReader(open(p, newline="", encoding="utf-8")))
def wcsv(p, rows, fields=None):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    fields = fields or list(rows[0].keys())
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fields, lineterminator="\n"); w.writeheader(); w.writerows(rows)
def rjson(p): return json.load(open(p, encoding="utf-8"))
