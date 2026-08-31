#!/usr/bin/env ruby
# encoding: utf-8
Encoding.default_external = Encoding::UTF_8
Encoding.default_internal = Encoding::UTF_8

require 'webrick'
require 'pathname'

port = (ARGV[0] || 3000).to_i
root_dir = File.expand_path(Dir.pwd).force_encoding("UTF-8")

mime_types = WEBrick::HTTPUtils::DefaultMimeTypes
mime_types['js'] = 'application/javascript; charset=utf-8'
mime_types['mjs'] = 'application/javascript; charset=utf-8'
mime_types['json'] = 'application/json; charset=utf-8'
mime_types['html'] = 'text/html; charset=utf-8'
mime_types['css'] = 'text/css; charset=utf-8'

server = WEBrick::HTTPServer.new(
  Port: port,
  DocumentRoot: root_dir,
  MimeTypes: mime_types,
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
  AccessLog: [[$stdout, WEBrick::AccessLog::COMBINED_LOG_FORMAT]]
)

trap('INT') { server.shutdown }
trap('TERM') { server.shutdown }

puts "=========================================================="
puts "  Quang Son - Your English Tutor"
puts "  Local Development Server is RUNNING at:"
puts "  👉 http://localhost:#{port}"
puts "  👉 http://127.0.0.1:#{port}"
puts "=========================================================="

server.start
