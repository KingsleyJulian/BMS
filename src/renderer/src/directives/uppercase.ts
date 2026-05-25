import type { Directive } from 'vue'

/**
 * `v-uppercase` — coerces an <input> or <textarea> to upper case.
 *
 * Applies `text-transform: uppercase` for the visual cue and listens for
 * `input` events. When the typed value differs from its upper-cased form we
 * mutate `el.value` and re-dispatch a bubbling `input` event so v-model
 * picks up the canonicalized value. The handler is naturally idempotent —
 * the second pass sees `el.value === upper` and returns without dispatching
 * again, so there is no infinite loop.
 *
 * Why on input instead of, say, transforming v-model with a modifier:
 * doing it at the DOM level means the cursor stays stable, paste/IME flows
 * work, and every framework binding (v-model, native @input, plain refs)
 * sees the same canonical value.
 */
export const uppercase: Directive<HTMLInputElement | HTMLTextAreaElement> = {
  mounted(el) {
    el.style.textTransform = 'uppercase'
    el.addEventListener('input', () => {
      const upper = el.value.toUpperCase()
      if (el.value === upper) return
      const start = el.selectionStart
      const end = el.selectionEnd
      el.value = upper
      if (start !== null && end !== null) el.setSelectionRange(start, end)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
}
