//ws.js
const {
  EventEmitter
} = require('events');
const http = require('http');
const crypto = require('crypto');
// const { Writable } = require('stream');

// 也就是用客户端传过来的 key，加上一个固定的字符串，经过 sha1 加密之后，转成 base64 的结果
function hashKey(key) {
  const sha1 = crypto.createHash('sha1');
  sha1.update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11');
  return sha1.digest('base64');
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
/**
 * Masks a buffer using the given mask.
 *
 * @param {Buffer} source The buffer to mask
 * @param {Buffer} mask The mask to use
 * @param {Buffer} output The buffer where to store the result
 * @param {Number} offset The offset at which to start writing
 * @param {Number} length The number of bytes to mask.
 * @public
 */
function applyMask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
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
// 少量数据
function encodeMessage(opcode, payload) {
  //payload.length < 126
  let bufferData = Buffer.alloc(payload.length + 2 + 0);

  let byte1 = parseInt('10000000', 2) | opcode; // 设置 FIN 为 1
  let byte2 = payload.length;

  bufferData.writeUInt8(byte1, 0);
  bufferData.writeUInt8(byte2, 1);

  payload.copy(bufferData, 2);

  return bufferData;
}


class MyWebsocket extends EventEmitter {
  constructor(options) {
    super(options);

    const server = http.createServer();
    server.listen(options.port || 8080);

    server.on('upgrade', (req, socket) => {
      this.socket = socket;
      // socket.setKeepAlive(true);

      // websocket 升级协议
      const resHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Accept: ' + hashKey(req.headers['sec-websocket-key']),
        '',
        ''
      ].join('\r\n');
      socket.write(resHeaders);

      socket.on('data', (data) => {
        this.processData(data);
        // console.log(data, 111);
      });
      socket.on('close', (error) => {
          this.emit('close', error);
      });
    });
  }
  
  handleRealData(opcode, realDataBuffer) {
    console.log('opcode ---> ', opcode)
    console.log('realDataBuffer ---> ', realDataBuffer)
    switch (opcode) {
      case OPCODES.TEXT: // 文本
        this.emit('data', realDataBuffer);
        break;
      case OPCODES.BINARY: // 二进制
        this.emit('data', realDataBuffer);
        break;
      default:
        this.emit('close');
        break;
    }
  }
  // 处理 WebSocket 协议中的数据帧
  processData(bufferData) {
    console.log('bufferData ---> ', bufferData)
    const byte1 = bufferData.readUInt8(0); // 第一个字节（byte1）中读取操作码（opcode），这是一个4位的值，用于指示帧的类型（如文本、二进制等）。
    let opcode = byte1 & 0x0f; 
    
    const byte2 = bufferData.readUInt8(1); // 从第二个字节（byte2）中读取掩码位（MASK），这是一个1位的值，指示是否使用了掩码。
    const str2 = byte2.toString(2);
    const MASK = str2[0];
    console.log('opcode ---> ', opcode)
    console.log('mask ---> ', MASK)

    let curByteIndex = 2;
    
    let payloadLength = parseInt(str2.substring(1), 2);
    if (payloadLength === 126) {
      payloadLength = bufferData.readUInt16BE(2);
      curByteIndex += 2;
    } else if (payloadLength === 127) {
      payloadLength = bufferData.readBigUInt64BE(2);
      curByteIndex += 8;
    }
    console.log('payloadLength ---> ', payloadLength)
    let realData = null;
    
    if (MASK) {
      const maskKey = bufferData.slice(curByteIndex, curByteIndex + 4); // 掩码密钥
      curByteIndex += 4;
      const payloadData = bufferData.slice(curByteIndex, curByteIndex + payloadLength);
      realData = handleMask(maskKey, payloadData); // 使用掩码密钥对有效载荷数据进行解密，以获取实际的数据（realData）。
    } 
    console.log('realData ---> ', realData)
    this.handleRealData(opcode, realData); // 处理有效载荷
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

