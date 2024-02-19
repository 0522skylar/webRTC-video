//ws.js
const { EventEmitter } = require('events');
const http = require('http');
const crypto = require('crypto');
const SingleData = require('./clientSocket.js')

// 也就是用客户端传过来的 key，加上一个固定的字符串，经过 sha1 加密之后，转成 base64 的结果
function hashKey(key) {
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
  return sha1.digest('base64');
}

class MyWebsocket extends EventEmitter {
  constructor(options) {
    super();
    options = {
      ...options,
    }

    const server = http.createServer();
    server.listen(options.port || 8080);
    this.clients = new Set()
  

    server.on('upgrade', (req, socket) => {
      this.socket = socket;
      
      socket.setKeepAlive(true);
      // websocket 升级协议
      const resHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + hashKey(req.headers['sec-websocket-key']),
        '',
        '',
      ].join('\r\n');
      socket.write(resHeaders);
      const ws = new SingleData(socket);
      
      ws.on('close', () => {
        this.clients.delete(ws)
        console.log('close')
      })
      ws.on('end', () => {
        this.clients.delete(ws)
        console.log('end')
      })
      ws.on('error', (err) => {
        console.log('error', err)
      })
      

      if (this.clients) {
        this.clients.add(ws)
      }
      this.emit('connection', ws);

    });
  }

}

module.exports = MyWebsocket;