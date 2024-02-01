//ws.js
const {
  EventEmitter
} = require('events');
const crypto = require('crypto');


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


class SingleData extends EventEmitter  {
  constructor(socket) {
    super();
    this['kWebSocket'] = undefined;
    // socket.on('close', socketOnClose);
    this.socket = socket

    this.socket.on('data', (data) => { // 传输数据
      // console.log(data, 123344)
      this.processData(data);
    });
    this.socket.on('close', () => {
      // this.clients.delete(socket)
      // console.log('close')
      this.emit('close')
    })
    this.socket.on('end', () => {
      // this.clients.delete(socket)
      this.emit('end')
      console.log('end')
    })
    this.socket.on('error', (err) => {
      // console.log('error', err)
      this.emit('error', err)
    })
    
  }
  handleRealData(opcode, realDataBuffer) {
    switch (opcode) {
      case OPCODES.TEXT: // 文本
        this.emit('message', realDataBuffer);
        break;
      case OPCODES.BINARY: // 二进制
        this.emit('message', realDataBuffer);
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
      console.log(data)
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

module.exports = SingleData;