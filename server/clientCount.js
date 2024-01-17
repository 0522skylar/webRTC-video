//ws.js
const { EventEmitter } = require('events');
const http = require('http');
const crypto = require('crypto');

// 也就是用客户端传过来的 key，加上一个固定的字符串，经过 sha1 加密之后，转成 base64 的结果
function hashKey(key) {
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
  return sha1.digest('base64');
}

// 处理大量数据
function frame(data) {
  options = {
    fin: true,
    mask: false,
    opcode: 2,
    readOnly: true,
    rsv1: false,
    kByteLength: data.length
  }
  let mask;
  let merge = false;
  let offset = 2;
  let skipMasking = false;

  if (options.mask) {
    mask = options.maskBuffer || maskBuffer;

    if (options.generateMask) {
      options.generateMask(mask);
    } else {
      randomFillSync(mask, 0, 4);
    }

    skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
    offset = 6;
  }

  let dataLength;

  if (typeof data === 'string') {
    if (
      (!options.mask || skipMasking) &&
      options[kByteLength] !== undefined
    ) {
      dataLength = options[kByteLength];
    } else {
      data = Buffer.from(data);
      dataLength = data.length;
    }
  } else {
    dataLength = data.length;
    merge = options.mask && options.readOnly && !skipMasking;
  }

  let payloadLength = dataLength;

  if (dataLength >= 65536) {
    offset += 8;
    payloadLength = 127;
  } else if (dataLength > 125) {
    offset += 2;
    payloadLength = 126;
  }

  const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);

  target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
  if (options.rsv1) target[0] |= 0x40;

  target[1] = payloadLength;

  if (payloadLength === 126) {
    target.writeUInt16BE(dataLength, 2);
  } else if (payloadLength === 127) {
    target[2] = target[3] = 0;
    target.writeUIntBE(dataLength, 4, 6);
  }

  if (!options.mask) return [target, data];

  target[1] |= 0x80;
  target[offset - 4] = mask[0];
  target[offset - 3] = mask[1];
  target[offset - 2] = mask[2];
  target[offset - 1] = mask[3];

  if (skipMasking) return [target, data];

  if (merge) {
    applyMask(data, mask, target, offset, dataLength);
    return [target];
  }

  applyMask(data, mask, data, 0, dataLength);
  return [target, data];
}
function handleMask(maskBytes, data) {
  const payload = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    payload[i] = maskBytes[i % 4] ^ data[i];
  }
  return payload;
}
const OPCODES = {
  CONTINUE: 0,
  TEXT: 1,
  BINARY: 2,
  CLOSE: 8,
  PING: 9,
  PONG: 10,
};

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
      debugger
      socket.on('data', (data) => {
        // console.log(data)
        this.processData(data);
      });
      socket.on('close', () => {
        this.clients.delete(socket)
        console.log('close')
      })
      socket.on('end', () => {
        this.clients.delete(socket)
        console.log('end')
      })
      socket.on('error', (err) => {
        console.log('error', err)
      })
      

      if (this.clients) {
        this.clients.add(socket)
      }
      console.log(this.clients.size, 'clients.size')
    });
  }

  handleRealData(opcode, realDataBuffer) {
    switch (opcode) {
      case OPCODES.TEXT: // 文本
        this.emit('data', {realDataBuffer, clients: this.clients});
        break;
      case OPCODES.BINARY: // 二进制
        this.emit('data', {realDataBuffer, clients: this.clients});
        break;
      default:
        this.emit('close');
        break;
    }
  }

  processData(bufferData) {
    const byte1 = bufferData.readUInt8(0);
    let opcode = byte1 & 0x0f; 
    
    const byte2 = bufferData.readUInt8(1);
    const str2 = byte2.toString(2);
    const MASK = str2[0];

    let curByteIndex = 2;
    
    let payloadLength = parseInt(str2.substring(1), 2);
    if (payloadLength === 126) {
      payloadLength = bufferData.readUInt16BE(2);
      curByteIndex += 2;
    } else if (payloadLength === 127) {
      payloadLength = bufferData.readBigUInt64BE(2);
      curByteIndex += 8;
    }

    let realData = null;
    
    if (MASK) {
      const maskKey = bufferData.slice(curByteIndex, curByteIndex + 4);  
      curByteIndex += 4;
      const payloadData = bufferData.slice(curByteIndex, curByteIndex + payloadLength);
      realData = handleMask(maskKey, payloadData);
    } 
    
    this.handleRealData(opcode, realData);
  }

  send(data) {
    let opcode;
    let buffer;
    if (Buffer.isBuffer(data)) {
      opcode = OPCODES.BINARY;
      buffer = data;
    } else if (typeof data === 'string') {
      opcode = OPCODES.TEXT;
      buffer = Buffer.from(data, 'utf8');
    } else {
      console.error('暂不支持发送的数据类型')
    }
    this.doSend(opcode, buffer);
  }

  doSend(opcode, bufferDatafer) {
    // 少量数据
    // this.socket.write(encodeMessage(opcode, bufferDatafer));
    // 大量数据
    let list = frame(bufferDatafer)
    // console.log(list)
    if (list.length === 2) {
      this.socket.cork();
      this.socket.write(list[0]);
      this.socket.write(list[1]);
      this.socket.uncork();
    } else {
      this.socket.write(list[0]);
    }
  }

}

module.exports = MyWebsocket;