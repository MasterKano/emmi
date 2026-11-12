/* Phone Research layout. Desktop keeps the full filter row and an open review. */
export const PHONE_MEDIA = "(max-width: 600px)";

export const PRIMARY_SLOTS = ["period", "sector", "watch"];
export const SECONDARY_SLOTS = ["search", "significance", "direction", "country"];

export function eventFilterPlacement(isPhone) {
  if (isPhone) {
    return {
      bar: PRIMARY_SLOTS.slice(),
      moreLead: SECONDARY_SLOTS.slice(),
    };
  }
  return {
    bar: ["search", "significance", "direction", "period", "sector", "country", "watch"],
    moreLead: [],
  };
}

/* Phone starts collapsed. Desktop stays open unless the reader closed it.
   A phone choice is stored apart from the desktop choice. */
export function briefingStartsOpen(isPhone, read) {
  let saved = null;
  try { saved = read(isPhone ? "moonshot-briefing-phone" : "moonshot-briefing"); } catch (err) { saved = null; }
  if (isPhone) return saved === "1";
  return saved !== "0";
}
