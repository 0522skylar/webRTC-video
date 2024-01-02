const WebSocket = require('ws');

// 创建一个 WebSocket 服务器，监听 8080 端口
const wss = new WebSocket.Server({ port: 8000 });

console.log('Server started, port is 8000');
// 当有客户端连接时，创建一个 WebSocket 并将其添加到客户端列表中
wss.on('connection', function connection(ws) {
  console.log('Client connected');

  // 当客户端发送消息时，将消息发送给所有客户端
  ws.on('message', function incoming(message) {
    // console.log('Received message:', message.toString('utf8')); // 接受的对象，客户端发送的是字符串,Buffer

    // 将消息发送给所有客户端
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message); // 客户端接受的是blob格式数据
      }
    });
  });

  // 当客户端断开连接时，将其从客户端列表中删除
  ws.on('close', function close() {
    console.log('Client disconnected');
  });
});