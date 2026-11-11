---
type: documentation
status: active
agent: [claude]
date: 2026-10-31
tags: [calculo3, arquitetura]
lock: none
---

# Summary
Caminho do dado na Bancada de Cálculo III, da tecla até a GPU, e as regras que cada
camada precisa manter para o site seguir exato, leve e sem `eval`.

# Arquitetura

```
texto da linha → lexer → parser → valor (Expr) → resolve (Analise)
                                                     ├── desenhos → worker de malhas → cena
                                                     └── calcula  → worker de cálculo → cartão
```

**A fonte da verdade é o texto.** O store guarda só as linhas, e `resolve` é uma função
pura dele. Os workers recebem texto e números e resolvem por conta própria, então
nada de árvore com BigInt cruza `postMessage` e a interface nunca espera por uma conta.

## Álgebra (`math/alg.ts`)

Os construtores `soma`, `prod`, `pot` e `fn` já devolvem a forma canônica. Quem deriva,
substitui ou integra usa só eles; não existe `simplify`. Números são racionais em BigInt.
Regras não triviais moram ali: `sen²+cos²` com fator comum, inclusive `sen⁴ = sen²·sen²`,
que fecha o normal da esfera; radicais extraídos; √(u²) = |u|.

`semModulo` tira |u| quando u não troca de sinal na região, por amostragem: √(r²) só vira
r porque r ≥ 0 ali.

## Integrais (`lang/calculos.ts`)

`integraRegiao` sempre roda as duas contas. A simbólica integra de dentro para fora; a
numérica é tanh-sinh em produto tensorial, porque Gauss-Legendre perde dígitos em
√(1−x²) na borda de um disco. Só leva selo de exato se concordarem e a quadratura tiver
convergido. Sem primitiva, `reconhece` tenta uma forma fechada, e o cartão avisa que ela
não foi demonstrada.

Green, Stokes e Gauss valem para qualquer região iterada: a borda é o contorno do
retângulo de parâmetros, e as costuras internas se cancelam sozinhas.

## Avaliação em lote (`math/lote.ts`)

Expressão vira lista de instruções sobre `Float64Array`, com subexpressões compartilhadas.
Cada laço roda sobre o lote inteiro e o JIT o compila como laço numérico. É o que permite
manter a CSP sem `unsafe-eval`. `varre` fatia em 8192 pontos: sem isso, um milhão de pontos
com 50 registradores pediria 400 MB.

## Malhas (`malha/malhas.ts`)

- `grade`: borda de domínio por bissecção; `saltoMax` corta paredes falsas de polos.
- `malhaIsosuperficie`: tetraedros em volta da diagonal do cubo (fechado por construção) e
  três passos de Newton com passo limitado.
- `recorta`: triângulo a triângulo, e `compacta` tira os vértices órfãos.
- `facesDe`: região iterada em seis faces; θ de 0 a 2π elimina a parede interna.

## Cena (`cena/`)

Regras herdadas da Física, cada uma nascida de um defeito medido:

1. Nada de `<xGeometry args>` que muda por quadro. A R3F libera a antiga em tarefa ociosa,
   que não roda com a cena animando. `GeoDinamica` só cresce e atualiza no lugar.
2. Material persiste: trocar de objeto religa o shader. Opções viram uniformes.
3. Medir `createBuffer` e `linkProgram` por quadro, nunca o saldo, e conferir o número de
   quadros: zero numa medida com 0 quadros não é resultado.

`hud.ts` fica fora de `Viewport.tsx` para a barra não puxar o three para a primeira tela. O
`zustand` mora no pedaço do React pelo mesmo motivo; `scripts/orcamento.mjs` reprova o build
se isso regredir.

## Fluxo de atualização

`motor.ts` mantém um pedido de malha em voo e guarda só o mais recente. Arrastando ou
animando, pede qualidade média; 180 ms depois, a alta. A assinatura de cada desenho inclui
só os números que ele usa, então mover `a` não refaz o que não depende de `a`.

Com mais de quatro superfícies visíveis, a animação pede a malha baixa, e o worker encolhe a
grade de cada uma pela raiz de 4/n: o total de triângulos fica parado. As peças que chegam do
worker entram juntas, uma vez por quadro. `GeoDinamica` só reenvia índices e coordenadas de
grade quando mudam: escrever num buffer que a placa ainda está lendo faz o driver esperar.
Esse envio desnecessário, e não o shader, era o que travava a thread principal por segundos.

## Ritmo da tela (`Ritmo` em `cena/Viewport.tsx`)

Meta: um quadro por atualização da tela, 120 quadros/s numa tela de 120 Hz. O ritmo da tela sai
dos quadros mais rápidos, que o vsync prende a ele. Em movimento, quatro perdas (quadro acima de
1,5 intervalo) em 20 quadros baixam a densidade 18%, até 0,5; um segundo e meio sem perda sobe
10%, sem voltar ao nível que falhou nos 8 s anteriores. Quadro acima de 4 intervalos é pico de
compilação ou envio, e só conta quando se repete. Parada por 500 ms, a cena desenha um quadro na
densidade inteira; o celular começa em 1,5.

Travas contra a espiral para baixo, achadas com gestos de toque reais no perfil de celular: só
conta o intervalo até um quadro que o anterior pediu (`internal.frames > 0` no fim do quadro);
quadros soltos de malha chegando ou teclado abrindo não são perda. Depois de cada troca, 12
quadros não contam, porque realocar o canvas deixa o seguinte lento. Quadro em que a CPU usou 60%
do intervalo não conta. E se baixar não cortou 10% do tempo médio do quadro, a densidade volta e o controle
espera de 10 a 60 s antes de tentar de novo. No celular não há troca de densidade ao parar.

A densidade vai como prop do Canvas, pelo `useHud`: a R3F reaplica a prop `dpr` a cada render do
Canvas, e um `setDpr` direto era desfeito no clique seguinte da barra.

## Custo por quadro

Cada corte foi medido antes de entrar:

- Lambert no lugar do material físico, sem mapa de ambiente: o custo por pixel decidia.
- Antisserrilhado da placa só com densidade abaixo de 1,5 e sem tela de toque.
- Grade de 128 (era 180), implícita de 48, setas de 6 e 8 lados, linhas de fluxo com metade dos
  segmentos.
- Superfície transparente numa passada só: uma cor por superfície, então a ordem quase não aparece.
- Grade e caixa numa chamada, eixos noutra, rótulos em duas (atlas e quadrados instanciados): de
  31 a 44 chamadas por quadro para 5 a 12. No celular, cada chamada é CPU por quadro.
- `Aquecimento` compila um programa de cada peça na abertura, em paralelo, na camada 31.
- `checkShaderErrors` só em desenvolvimento: a conferência esperava a placa ligar o programa.
- Editores MathLive criados um por vez, nas folgas entre quadros; até lá, a fórmula em KaTeX. Na
  tela de toque, a expressão só vira editor num toque de verdade (`click`, não `pointerdown`) e
  volta a KaTeX ao perder o foco: rolar a lista por cima de um editor o focava e abria o teclado,
  que redimensiona a página e a cena. O MathLive nem carrega antes da primeira edição.

Medir: `?fps` mostra a taxa; `?fps=sync` lê um pixel por quadro e soma CPU e placa, o que infla o
tempo; `?alvo=120` fixa o ritmo sem vsync; `?ritmo=0` desliga o controle; `?aa=0` tira o
antisserrilhado. A medida certa da placa é a consulta de tempo (`EXT_disjoint_timer_query_webgl2`)
em volta do render, com o quadro limitado pelo maior entre CPU e placa.
