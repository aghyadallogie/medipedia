/**
 * Shared interaction classes. The hover effects themselves are defined in globals.css
 * ("Hover effects"). Colour, glow and fade feedback always applies; anything that moves or
 * scales is added there only when the system allows motion.
 */

/** A card or tile that is one big link: a blue line draws in, a halo glows, it lifts a little. */
export const liftOnHover = 'accent-card'

/** A button or button-like link: tiny lift on hover, squeezes on tap. */
export const pressable =
  'transition duration-150 ease-out hover:shadow-sm motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0 motion-safe:active:scale-[0.97]'

/** A primary button: a soft highlight sweeps across it once on hover (motion allowed only). */
export const sheen = 'sheen'

/** Images inside a `group` slowly zoom when the group is hovered. The parent must clip overflow. */
export const zoomOnGroupHover =
  'transition-transform duration-500 ease-out motion-safe:group-hover:scale-105'
