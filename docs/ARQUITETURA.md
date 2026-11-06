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

Com mais de quatro superfícies visíveis, a animação pede a malha baixa. As peças que chegam do
worker entram juntas, uma vez por quadro. `GeoDinamica` só reenvia índices e coordenadas de
grade quando mudam: escrever num buffer que a placa ainda está lendo faz o driver esperar.
Esse envio desnecessário, e não o shader, era o que travava a thread principal por segundos.

## Densidade adaptativa

Numa sequência de quadros, se a média passa de 26 ms, a densidade de pixels cai 30%, até 1.
Parada por 600 ms, a cena volta à densidade inteira num quadro só. `?fps` mostra a medida, e
`?fps=sync` inclui o tempo da placa. Sem sincronizar, o Edge sem janela relata centenas de
quadros que a placa não desenhou.
