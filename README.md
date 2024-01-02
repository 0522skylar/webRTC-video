## 项目简介

本项目是基于socket连接两个客户端，实现双向视频通讯的功能。


## 项目结构

```
.
├── client
│   ├── socketA.html
│   ├── socketB.html
├── server
│   ├── app.js
├── README.md
└── package.json
```

## 项目运行

```bash
# 1. 启动服务端
npm install
cd server
node app.js

# 2. 启动客户端
cd client
# 使用扩展商店的Live Server插件启动页面socketA.html和socketB.html
Open with Live Server

```