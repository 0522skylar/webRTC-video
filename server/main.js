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
      if (client !== wws.socket) { // wws.socket是最后连接的客户端，不是当前发生消息的客户端
        wws.send(realDataBuffer); // 客户端接受的是blob格式数据
      }
    });
  }
});

ws.on('close', () => {
  console.log('close');
})