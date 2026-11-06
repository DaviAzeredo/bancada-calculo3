// Copia as fontes do editor de fórmulas para public/: a CSP só aceita fontes do próprio site.
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('public/mathlive-fonts', { recursive: true })
cpSync('node_modules/mathlive/fonts', 'public/mathlive-fonts', { recursive: true })
