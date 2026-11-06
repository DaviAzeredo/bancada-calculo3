---
type: documentation
status: active
agent: [claude]
date: 2026-10-31
tags: [calculo3, design, tokens]
lock: none
---

# Summary
Tokens visuais da Bancada de Cálculo III, contrato de UI do protocolo de excelência e
rubrica medida. A interface é irmã da Bancada de Física, com acento âmbar próprio e tema claro.

# Design — Bancada de Cálculo III

Conceito: **caderno de contas ao lado do espaço**. A lista de expressões é a coluna do
caderno; a cena ocupa todo o resto. Abre direto na ferramenta, com uma conta já pronta.

## Cor (OKLCH)

| token | escuro | claro | papel |
| --- | --- | --- | --- |
| --bg | 0.175 0.012 262 | 0.975 0.003 262 | fundo |
| --surface | 0.205 0.013 262 | 0.995 0.002 262 | painéis e flutuantes |
| --text | 0.95 0.005 262 | 0.24 0.012 262 | texto principal |
| --text-3 | 0.67 0.012 262 | 0.5 0.012 262 | rótulos |
| --accent | 0.83 0.13 78 | 0.56 0.13 62 | foco, seleção, ação principal |
| --ok | 0.8 0.13 158 | 0.48 0.12 158 | resultado conferido |
| --danger | 0.72 0.17 25 | 0.52 0.18 25 | erro |

Eixos seguem x vermelho, y verde, z azul. Módulo de campo e altura usam o mesmo mapa frio →
quente, para que a mesma cor signifique o mesmo em setas, linhas e superfícies. Oito cores
de objeto, escolhidas para não se confundirem com o acento.

## Tipografia e forma

Inter na interface, JetBrains Mono em números, KaTeX nos resultados e MathLive na edição.
Raio de 6 px em controles e 10 px em flutuantes; bordas de 1 px, sem sombra nos painéis.
Decimal com vírgula em tudo o que o aluno lê.

## Superfícies

Grade e curvas de nível vêm do fragment shader, com espessura em pixels. O verso sai 28%
mais escuro: dá para saber de que lado da superfície se está, o que importa em fluxo e
na faixa de Möbius. Recorte pela caixa em planos de clipping.

## Contrato de UI

```yaml
interface_goal: escrever fórmula e ver e resolver Cálculo III em 3D
audience: alunos de Cálculo III
domain: ferramenta científica educacional
platforms: [web desktop, web mobile]
primary_workflows: [digitar fórmula, mover controle, abrir exemplo, ver passo a passo, compartilhar link]
visual_reference_class: GeoGebra 3D, Desmos 3D, CalcPlot3D, software científico
design_system: tokens deste arquivo
accessibility_target: WCAG_2_2_AA
content_density: alta no painel, baixa na cena
interaction_model: orbit + editor de fórmulas + controles + ações por objeto
states_required: [carregando, calculando, vazio, erro de sintaxe, símbolo sem definição, webgl indisponível, integral divergente]
responsive_viewports: [375, 1360]
```

## Rubrica

| Dimensão | Nota | Evidência |
| --- | --- | --- |
| Hierarquia | 3,5 | Fórmula, resultado e selo em ordem de leitura; cena domina |
| Composição | 3,5 | Coluna fixa e cena cheia; no celular, cena acima e lista abaixo |
| Tipografia | 3,5 | Duas fontes e fórmulas compostas, números tabulares |
| Cor | 3,5 | Papel funcional, mapa único de módulo, dois temas |
| Componentes | 3,5 | Mesmo botão, pílula e controle em todo o site |
| Estados | 4 | Todos do contrato, com recuperação (criar controle, ação por objeto) |
| Responsivo | 3,5 | Sem estouro em 375 px; app encolhe com o teclado virtual |
| Acessibilidade | 3 | Rótulos, foco visível, movimento reduzido; sem auditoria com leitor de tela |
| Interação | 3,5 | Edição viva, malha grossa ao arrastar e fina ao soltar |
| Performance | 3,5 | 191 kB gz na primeira tela; 0 buffer por quadro; sem medição em GPU real |

Média 3,5. Nenhuma dimensão abaixo de 3.
