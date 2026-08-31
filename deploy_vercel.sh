#!/bin/bash
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"

echo "=================================================="
echo "🚀 QUANG SON - YOUR ENGLISH TUTOR: DEPLOY TO VERCEL"
echo "=================================================="
echo "Hệ thống sẽ tiến hành build và xuất bản trang web lên Vercel..."
echo ""

npx --yes vercel --prod
