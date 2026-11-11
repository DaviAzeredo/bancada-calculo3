---
type: project
status: active
agent: [claude]
date: 2026-10-31
tags: [calculo3, ufrj, calculo, three, r3f, educacao]
lock: none
---

# Summary
Calculadora gráfica 3D para Cálculo III: escreve-se a fórmula como no caderno e a cena
mostra superfícies, curvas, campos e sólidos, enquanto o painel resolve derivadas,
integrais e os teoremas de Green, Stokes e Gauss com passo a passo. Toda integral exata é
conferida por uma quadratura independente. Site estático, sem servidor e sem custo por aluno.

# Bancada · Cálculo III

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 513 testes: álgebra, primitivas, parser, problemas clássicos, malhas, exemplos, entrada hostil
npm run build      # site estático em dist/, com orçamento do JS da primeira tela
```

## O que aceita

Cada expressão é classificada sozinha. Não há modo de digitação nem caixa de diálogo. O guia
tem busca (sem acento e sem caixa) e traz junto os exemplos prontos do mesmo assunto.

| Escrita | O que vira |
| --- | --- |
| `z = x^2 - y^2`, `x = y^2` | gráfico |
| `x^2 + y^2 + z^2 = 4` | superfície implícita |
| `f(x,y) = sen x cos y` | função com nome, usável nas outras linhas |
| `g(x,y,z) = x^2 + y^2 + z^2` | campo escalar com superfícies de nível |
| `S(u,v) = (…), 0≤u≤2π, 0≤v≤π` | superfície paramétrica |
| `z = r^2`, `ρ = 2`, `φ = π/4`, `θ = π/4` | coordenadas cilíndricas e esféricas |
| `r(t) = (cos t, sen t, t), 0≤t≤4π` | curva, com seta de orientação |
| `F(x,y,z) = (y, -x, z)`, `F = y i - x j` | campo: setas, linhas de fluxo, partículas |
| `P = (1,2,3)`, `v = (1,2,3)` | maiúscula é ponto; minúscula, vetor |
| `R: 0≤x≤1, 0≤y≤x`, `E: 0≤ρ≤1, 0≤φ≤π, 0≤θ≤2π` | região ou sólido iterado |
| `x^2+y^2 ≤ z ≤ 4` | sólido por desigualdades (só desenho) |
| `z = x^2 {x^2+y^2 ≤ 1}` | restrição recortada com borda nítida |
| `a = 2` | controle deslizante, com animação |

Integrais: `∫_0^1 ∫_0^x x y dy dx`, `∬_R f dA`, `∭_E f dV`, `∮_C F·dr`, `∮_C P dx + Q dy`,
somas e múltiplos de integrais (`∫_A F·dr + ∫_B F·dr + ∫_D F·dr`, para contornos por pedaços),
`∫_C f ds`, `∬_S F·dS`, `∬_S f dS`, com limites infinitos.

Comandos: `grad`, `div`, `rot`, `lap`, `tangente`, `direcional`, `criticos`, `lagrange`,
`taylor`, `hessiana`, `potencial`, `comprimento`, `curvatura`, `torcao`, `frenet`, `area`,
`volume`, `massa`, `centroide`, `linha`, `fluxo`, `green`, `stokes`, `gauss`, `jacobiano`,
`riemann`, `fatia`, `sonda`, `curvas`.

Valem `sen`, `tg`, `cotg`, `cossec`, `arctg`, `senh`, além dos nomes em inglês.

## Como confia nos números

| Selo no cartão | O que garante |
| --- | --- |
| Exato, conferido | A primitiva passou por F′ = f em pontos sorteados e o valor bateu com a quadratura tanh-sinh |
| Forma reconhecida | A primitiva não saiu: a forma fechada veio do decimal e não foi demonstrada |
| Numérico | Quadratura, com o erro estimado entre dois níveis |

Sem convergência numérica, nada leva selo de exato: é assim que `∫₋₁¹ dx/x²` deixa de dar −2.

## Estrutura

- `src/math/`: álgebra canônica em racionais BigInt, derivadas, primitivas, quadratura, LaTeX e avaliador em lote.
- `src/lang/`: gramática única de LaTeX e texto, classificação das linhas, regiões e cálculos.
- `src/malha/`: malhas e os dois workers (malhas e cálculos). Recebem texto e números.
- `src/cena/`: cena R3F em eixo z para cima, com medidas reais, sem escala por eixo.
- `src/ui/`: painel, editor, cartões de resultado, galeria e guia.

Detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md) e [DESIGN.md](DESIGN.md).

Segmento de P a Q: `B(t) = (1-t)P + tQ, 0 ≤ t ≤ 1`.

## Fluidez: um quadro por atualização da tela

A meta é 120 quadros/s sem queda: todo quadro em até 8,3 ms. A cena se ajusta ao ritmo da tela
(60, 90, 120 Hz): em movimento, baixa ou sobe a densidade de pixels para caber num intervalo, e
parada desenha um quadro nítido. O resto do orçamento vem de cortes medidos: sombreamento Lambert,
antisserrilhado só em tela de densidade baixa, grade de 128, rótulos e eixos em poucas chamadas,
programas compilados de antemão e editores criados um por vez.

Medido numa Intel UHD integrada, na tomada, a 1920×1080 com densidade 1,25, câmera girando e
tempo da placa por consulta de tempo: as 38 cenas da galeria com todo quadro abaixo de 8,3 ms na
resolução cheia, e o pior quadro de todas em 4,8 ms; na bateria, 37 de 38. Dezesseis superfícies
transparentes juntas pedem o ajuste de densidade, e com ele também ficam abaixo de 8,3 ms. No
perfil de celular (tela de 412×915, toque, CPU 4 vezes mais lenta): na mediana, de 1 a 3,5 ms de
CPU e menos de 1 ms de placa por quadro.

No celular, a expressão fica em KaTeX e só vira editor num toque: rolar a lista não abre o teclado.

Acrescente `?fps` ao endereço (antes do `#`) para ver quadros por segundo, triângulos e a placa.
`?fps=sync` lê um pixel a cada quadro e soma o tempo da placa; serve para comparar versões, mas
infla o tempo de quadro, porque o navegador normal sobrepõe CPU e placa.

## Segurança

- CSP no build, sem `unsafe-eval`: fórmula vira programa de `math/lote.ts`, nunca `new Function`.
- Link compartilhado e `localStorage` passam por `saneia`, campo a campo; comandos de URL são recusados.
- Sem servidor, sem conta, sem cookie, sem rede depois de carregar. A cena não envia dados.
- KaTeX com `trust: false`. `npm audit`: zero.

## Publicação

`bash calculo3/scripts/publicar.sh` cria o repositório público e liga o Pages. Publicar
exige aval do dono a cada versão. Autor dos commits públicos: o endereço `noreply` do GitHub.

## Limites conhecidos

- Pontos críticos e Lagrange são numéricos (Newton a partir de uma grade) e só veem o que está na caixa.
- Primitivas por regras: sem frações parciais gerais. Sem primitiva, sai a quadratura.
- Sólido por desigualdades só desenha; para integrar, descreva a região por limites.
- `green`, `stokes` e `gauss` calculam a borda numericamente, e a orientação segue os parâmetros.
- Os pontos da cena se movem pelos controles do painel, não por arraste.
- A fiber ainda usa `THREE.Clock`, que avisa no console. Inofensivo.
