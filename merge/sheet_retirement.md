# Retiring the research Google Sheet (decision 30 Oct 2026)

Decision: the data files are the one source. The Sheet is a mirror written by the research owner's monthly
refresh; it is not edited by hand and nothing reads it. It is **left in place, unchanged** (not deleted) as a
frozen archive of its last refresh.

What stops:
- The monthly refresh step that rebuilds the Sheet tabs from the data files. No other job writes to it.
- Nothing in EMMA or on the site reads the Sheet, so no reader changes are needed.

What continues:
- The research owner edits/refreshes the research data files in the Moonshot repo as today. They reach EMMA as a
  read-only copy (`research/source/moonshot/`) by a normal PR, which triggers the research job.

Before the next monthly refresh (Mon 2 Nov 2026): drop the Sheet step, and keep event ids stable (frozen map).
