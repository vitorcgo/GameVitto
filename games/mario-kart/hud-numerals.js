/** Counters use the optional native DigitalNum artwork traced by prepare-ui-font.py. */
export function raceNumerals(element, value) {
  if (element.dataset.numerals === value) return;
  element.dataset.numerals = value;
  element.setAttribute('aria-label',value);
  element.textContent = value;
  element.classList.add('race-numerals');
}
