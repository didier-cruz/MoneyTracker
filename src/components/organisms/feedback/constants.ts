/**
 * Shared by every sheet/dialog in this folder that CHAINS into a second
 * modal after closing the first one (e.g. `ActionSheet`'s "Archive"
 * row closing itself, then opening a `ConfirmDialog`). Two RN `Modal`s
 * mounted at once wedges Android's back-button handling — a real,
 * reproducible bug on this platform, not a hypothetical one (verified
 * in the emulator while building this feature: opening the second
 * modal on the SAME frame the first one closes leaves the screen
 * unresponsive to the hardware back button). Closing first, then
 * opening the next modal after RN's own `Modal` has finished its
 * `animationType="slide"` transition, avoids the overlap. 300ms matches
 * that transition's duration on both platforms.
 */
export const MODAL_CHAIN_DELAY_MS = 300;
