#!/bin/bash
# Quang Son - Your English Tutor
# Development Server Starter
cd "$(dirname "$0")"
echo "🚀 Đang khởi động máy chủ Quang Son - Your English Tutor tại http://localhost:3000 ..."
ruby -EUTF-8:UTF-8 server.rb 3000
