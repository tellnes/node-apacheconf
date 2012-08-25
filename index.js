var inherits = require('util').inherits
  , EventEmitter = require('events').EventEmitter
  , Stream = require('stream').Stream
  , es = require('event-stream')
  , fs = require('fs')
  , glob = require('glob')

function removeQuotes(str) {
  if ((str[0] == '"' && str[str.length - 1] == '"') || (str[0] == "'" && str[str.length - 1] == "'"))
    str = str.slice(1, str.length -1 )

  return str
}


module.exports = function(filename, cb) {
  var stream = fs.createReadStream(filename)
    , parser = new Parser()

  parser.file = filename
  parser._stream = es.pause()
  parser.files = [ filename ]

  parser.name = 'global'

  parser._stream.on('end', function() {
    parser.end()
  })

  if (cb) {
    parser.on('error', cb)
    parser.on('end', function() {
      cb(null, parser.config, parser)
    })
  }

  setupPipeline(stream, parser)

  return parser
}

function setupPipeline(stream, parser) {
  stream.pipe(es.split('\n')).pipe(parser._stream).pipe(parser, { end: false })

  stream.on('error', function(err) {
    parser.emit('error', err)
  })

}


function ParseError(parser, message) {
  Error.call(this)
  Error.captureStackTrace(this)
  this.message = message
  this.parser = parser
  this.line = parser._getProp('lines')
  this.file = parser._getProp('file')
}
inherits(ParseError, Error)


function Parser() {
  Stream.call(this)
  this.writable = true
  this.lines = 0

  this._comments = []
  this.config = {}
}
inherits(Parser, Stream)


Parser.prototype.write = function(line) {
  this.lines++

  if (this._child) return this._child.write(line)

  line = line.trim()

  if (!line) return true

  switch(line[0]) {
  case '<':
    if (line[1] == '/') {
      if (line != '</' + this.name + '>') {
        this.emit('error', new ParseError(this, 'Expecting ' + this.name + ' close tag, got ' + line))
        return true
      }

      this.emit('end')
      return true
    }


    var child = new Parser()
      , self = this
    this._child = child
    child._parent = this

    function onerror(err) {
      self.emit('error', err)
    }
    function onend() {
      self._child = null
      self.add(child.name, child.config)

      child.removeListener('end', onend)
      child.removeListener('error', onerror)
    }

    child.on('end', onend)
    child.on('error', onerror)


    line = line.slice(1, line.length - 1)

    child.name = line.split(' ', 1)[0]
    child.args = removeQuotes(line.slice(child.name.length + 1))

    switch(child.name) {
    case 'VirtualHost':
      line = child.args.split(':')
      child.host = line[0]
      child.port = line[1]
      break

    // TODO: Handle more types
    }

    break

  case '#':
    this._comments.push(line)
    this.emit('comment', line)
    break

  default:
    var name = line.split(' ', 1)[0]
      , value = line.slice(name.length + 1).trim()

    switch(name) {
    case 'Include':
      var self = this

      this.pause()

      glob(value, function onfiles(err, files) {
        if (err) return self.emit('error', err)

        self._include(files.shift(), function(err) {
          if (err || files.length) return onfiles(err, files)
          self.resume()
        })

      })

      this.add(name, value)

      break

    default:
      this.add(name, value)
      break
    }

    break
  }

  return true
}

Parser.prototype.end = function() {
  if (arguments.length) this.write.apply(this, arguments)
  this.emit('end')
}

Parser.prototype.add = function(name, value) {
  if (!this.config[name]) {
    this.config[name] = []
    this.config[name].comments = []
  }

  this.config[name].push(value)
  this.config[name].comments.push(this._comments)

  this.emit('data', { name: name, value: value })
  this.emit(name, value)

  this._comments = []
}

Parser.prototype._getProp = function(prop) {
  var that = this
  while(!(prop in that) && that._parent) {
    that = that._parent
  }
  return that[prop]
}

Parser.prototype.pause = function() {
  return this._getProp('_stream').pause()
}

Parser.prototype.resume = function() {
  return this._getProp('_stream').resume()
}

Parser.prototype._include = function(filename, cb) {
  this._getProp('files').push(filename)

  var self = this
    , origStream = this._stream
    , origFile = this.file
    , origLines = this.lines
    , stream = fs.createReadStream(filename)

  self._stream = es.pause()
  self.file = filename
  self.lines = 0

  setupPipeline(stream, self)

  self._stream.on('end', function() {
    self._stream = origStream
    self.file = origFile
    self.lines = origLines

    cb()
  })

}
