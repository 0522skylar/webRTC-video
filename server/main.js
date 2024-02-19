// const MyWebSocket = require('./ws.js');
const MyWebSocket = require('./clientCount.js');
// const MyWebSocket = require('ws');
const ws = new MyWebSocket({ port: 8000 });
// websocket需要一个服务器，如果两个客户端需要通讯，需要用服务器转发\

/*
ws.on('data', (data) => {
  console.log('receive data:' + data); // 接受消息
  ws.send(data); // 自己给自己发送消息
  // 如何区分多个客户端呢???
});
*/


ws.on('data', function connection({realDataBuffer, clients}) {
  console.log('Client connected', realDataBuffer.toString('utf8'));
  // ws.send(data + ' ' + Date.now()); // 发送消息
  // 将消息发送给所有客户端
  if (clients) {
    clients.forEach(function each(client) {
      if (client !== ws.socket) { // ws.socket是最后连接的客户端，不是当前发生消息的客户端
        ws.send(realDataBuffer); // 客户端接受的是blob格式数据
      }
    });
  }
});


ws.on('close', (err) => {
  console.log('close', err);
})

// 以下是一些常见的WebSocket状态码及其含义：刷新页面1001

// 1000: 正常关闭（Normal Closure）。客户端和服务器都同意关闭连接，并且所有数据都已经发送和接收完成。
// 1001: 内部错误（Internal Error）。客户端遇到了无法处理的错误，因此关闭了连接。
// 1002: 协议错误（Protocol Error）。客户端认为服务器发送了一条无法理解的消息。
// 1003: 不支持的数据类型（Unsupported Data）。客户端无法理解服务器发送的数据类型。
// 1004: 无接收数据（No Status Received）。服务器没有收到任何关闭状态码。
// 1005: 服务器未指定错误（Server Not Specified）。服务器关闭了连接，但没有提供关闭状态码。
// 1006: 无法恢复的连接（Abnormal Closure）。连接由于无法恢复的错误而关闭。
// 1007: 无效的接收数据（Invalid Frame Payload Data）。服务器收到了一个数据帧，但数据不符合预期的格式。
// 1008: 策略禁止（Policy Violation）。客户端或服务器的策略不允许连接。
// 1009: 消息太大（Message Too Big）。服务器收到了一个太大的消息，无法处理。
// 在实际应用中，服务器端通常会记录这些状态码，以便进行错误分析和调试。如果状态码是1001，通常意味着客户端已经正常关闭了连接，服务器端不需要采取特别的措施。然而，如果频繁出现其他状态码，可能需要进一步检查客户端和服务器端的代码，以确定是否存在问题。以确定是否存在问题。