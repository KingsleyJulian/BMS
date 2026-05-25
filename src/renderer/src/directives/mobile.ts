import type { Directive } from 'vue'

/**
 * `v-mobile` — phone-number input. Strips spaces and dashes from the value
 * on every keystroke (and on paste) so what v-model captures is a clean
 * digit-only string. Plays nicely alongside `v-uppercase` (digits are
 * case-invariant, so the two directives don't fight).
 *
 * Cursor position is preserved by counting how many stripped characters
 * lay before the original caret index and shifting the new caret left by
 * that amount.
 */
export const mobile: Directive<HTMLInputElement | HTMLTextAreaElement> = {
  mounted(el) {
    el.addEventListener('input', () => {
      const original = el.value
      const stripped = original.replace(/[\s-]/g, '')
      if (original === stripped) return
      const caret = el.selectionStart ?? 0
      const removedBefore = original.slice(0, caret).match(/[\s-]/g)?.length ?? 0
      el.value = stripped
      const newCaret = caret - removedBefore
      el.setSelectionRange(newCaret, newCaret)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
}
