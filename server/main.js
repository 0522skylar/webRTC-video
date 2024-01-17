const MyWebSocket = require('./ws.js');
// const MyWebSocket = require('ws');
const ws = new MyWebSocket({ port: 8001 });
// websocket需要一个服务器，如果两个客户端需要通讯，需要用服务器转发\

ws.on('data', (data) => {
  console.log('receive data:' + data); // 接受消息
  // ws.send(data + ' ' + Date.now()); // 发送消息

  ws.send(data); // 自己给自己发送消息
  // 如何区分多个客户端呢???
  //
  // setInterval(() => {
  //   ws.send(data + ' ' + Date.now()); // 发送消息
  // }, 2000)

  // setInterval(() => {
  //   ws.send(data + '-- ' + Date.now()); // 发送消息
  // }, 3000)
});

ws.on('close', () => {
  console.log('close');
})