#!/usr/bin/env bash
# Publica o estado commitado de calculo3/ no repositório público do site e no
# GitHub Pages. Na primeira vez, cria o repositório e liga o Pages.
#
# Exporta só a árvore atual, sem o histórico do Vault.
#
# Uso: bash calculo3/scripts/publicar.sh      (REPO=conta/nome para outro destino)
set -euo pipefail
REPO="${REPO:-DaviAzeredo/bancada-calculo3}"
OWNER="${REPO%%/*}"
NAME="${REPO##*/}"
SITE="https://$(echo "$OWNER" | tr '[:upper:]' '[:lower:]').github.io/$NAME/"
here="$(cd "$(dirname "$0")/.." && pwd)"
vault="$(git -C "$here" rev-parse --show-toplevel)"
prefix="$(git -C "$here" rev-parse --show-prefix)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Criando $REPO (público)…"
  gh repo create "$REPO" --public \
    --description "Calculadora gráfica 3D para Cálculo III: superfícies, curvas, campos vetoriais e integrais com passo a passo, direto no navegador." \
    --homepage "$SITE"
fi

git clone --quiet "https://github.com/$REPO.git" "$tmp/pub" 2>/dev/null
git -C "$tmp/pub" checkout -q -B main
# a cópia temporária assina com o nome do Vault e o endereço sem resposta do GitHub:
# todo commit público mostra o e-mail do autor, e o pessoal não deve aparecer ali
git -C "$tmp/pub" config user.name "$(git -C "$vault" config user.name)"
git -C "$tmp/pub" config user.email "$(gh api user --jq '"\(.id)+\(.login)@users.noreply.github.com"')"
git -C "$tmp/pub" config core.autocrlf input
git -C "$tmp/pub" config core.safecrlf false
find "$tmp/pub" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
# exporta em LF: o Vault usa "* text=auto", e no Windows o padrão seria CRLF
git -C "$vault" -c core.autocrlf=false -c core.eol=lf archive HEAD "$prefix" | tar -x -C "$tmp"
cp -r "$tmp/$prefix." "$tmp/pub/"

msg="$(git -C "$vault" log -1 --format=%s -- "$prefix")"
git -C "$tmp/pub" add -A
enviado=0
if git -C "$tmp/pub" diff --cached --quiet; then
  echo "Nada novo para publicar: o site já está na versão do último commit de $prefix."
else
  git -C "$tmp/pub" commit -q -m "$msg"
  git -C "$tmp/pub" push -q -u origin main
  echo "Enviado: $msg"
  enviado=1
fi

# Pages servido pelo GitHub Actions (idempotente: só cria se ainda não existir)
if ! gh api "repos/$REPO/pages" >/dev/null 2>&1; then
  gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null
  echo "GitHub Pages ligado (fonte: GitHub Actions)."
fi

if [ "$enviado" = 1 ]; then
  echo "Site: $SITE (o deploy leva ~1–2 min; acompanhe em https://github.com/$REPO/actions)"
else
  echo "Site: $SITE"
fi
