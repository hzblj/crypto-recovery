import {adaptive, defineTheme} from '@hzblj/kara-ui'

/**
 * A sky-blue accent, the icon's, apart from the Nitro Wallet's emerald, the Airgap Example's indigo and the Vault
 * Example's amber so the examples never pass for each other: every accent token is set in one place, and the Android
 * seed moves with them.
 */
export const theme = defineTheme({
  colors: {
    border: {accent: '#0284c7'},
    content: {accent: adaptive({dark: '#38bdf8', light: '#0369a1'})},
    fill: {
      accent: {
        base: adaptive({dark: '#0284c733', light: '#e0f2fe'}),
        disabled: adaptive({dark: '#0284c71f', light: '#bae6fd'}),
        primary: '#0284c7',
      },
    },
    shadow: {btn: {accent: {ring: adaptive({dark: '#0284c700', light: '#7dd3fc'})}}},
  },
  materialSeed: '#0284c7',
})
