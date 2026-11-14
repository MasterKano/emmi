# Live Pulse comment: writing rules (data/live_comment.json)

Applies to every writer of `data/live_comment.json`: the 06:00 copy from the sent Pulse (`scripts/build_live_comment.py`)
and the fresh 12:00, 15:30 and 22:30 refreshes written from live prices.

## No tile repeats (Jerry, Sat 14 Nov 2026 11:51 Zurich)

> "Do not restate, summarise, or narrate any numbers, percentages, index levels, or changes that are already displayed in
> the data tiles/cards. Assume the reader is looking at the tiles. Only write text that adds context, drivers,
> implications, risks, or comparisons that cannot be read directly from the tiles. Cut any sentence whose sole purpose is
> to repeat what the tiles show."

The Live Pulse page already shows, live: the Markets tiles (equities, energy, rates, currencies, metals), the risk gauge
with each input's live value, and Where the money is going (1D/1W/1M for regions, sectors, commodities and FX). So the
headline, tone, body and views must not carry those prices, levels, % or bp moves, the gauge score, or a basket's move.

Write instead: why it moved (the news, the data print, the flow), what it means, what it links to, and what would change
the view. Numbers the page does not show are fine when they add a driver or a comparison: a single stock's move, a CPI or
PPI print, a Fed pricing probability, positioning, an earnings figure.

Worked example (22:30 wrap, Fri 13 Nov):
- Bad: "The S&P 500 closed down 0.4% at 7,561.67 and the Nasdaq down 0.9% at 25,136.27, while the Dow edged up 0.1%."
- Bad: "The live gauge reads −10, which is mixed, down from +4 at the US open."
- Good: "The softer PPI steadied the open, but the Nvidia hangover won the afternoon: chips led the selling again after
  Jensen Huang's exit, with AMD and Broadcom the biggest drags, while the Dow's value names held up."
- Good: "Money kept rotating from renewables and metals into oil majors, a sign the market is pricing supply risk from
  Hormuz over growth. What would change that: a credible Iran deal, which would take the premium out of crude first."

## Check before pushing

On the box: `/workspace/brief/.venv/bin/python /workspace/brief/lib/tile_repeat.py --live data/live_comment.json`
(exit 1 lists every sentence that pairs a tiled market, the gauge or a flow line with a number; rewrite them).
The same rule and check apply to the Pulse emails (`/workspace/brief/PRESEND_CHECK.md`).
