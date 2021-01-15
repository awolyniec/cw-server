const WebSocket = require('ws');

const { originWhitelist } = require('./config');

const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

// TODO: implement origin-checking

// in-memory data store
const USER_BY_USERNAME = {};
const USER_CLIENT_BY_USERNAME = {};

const broadcastMessageToAllUsers = (message) => {
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && Object.values(USER_CLIENT_BY_USERNAME).indexOf(client) >= 0) {
      client.send(message);
    }
  });
};

const isClientLoggedIn = client => !!Object.values(USER_CLIENT_BY_USERNAME).find(userClient => userClient === client);

const handleUserEnterChat = (client, message) => {
  const USERS = Object.values(USER_BY_USERNAME);
  const { data: { userName, color } } = message;
  if (!USER_BY_USERNAME[userName]) {
    console.log(`User entering chat: ${JSON.stringify(message, null, 2)}`);
    USER_BY_USERNAME[userName] = {
      name: userName,
      color
    };
    USER_CLIENT_BY_USERNAME[userName] = client;
    // inform all users that a user has entered (and confirm to the logged-in user that they have signed in)
    broadcastMessageToAllUsers(JSON.stringify({
      type: 'userEnterChat',
      data: {
        name: userName,
        color
      },
      createdAt: new Date()
    }));
    const otherUsers = USERS.filter(user => user.name !== userName);
    client.send(JSON.stringify({
      type: 'initialSlateOfOtherUsers',
      data: otherUsers
    }));
  } else {
    console.error(`Non-unique user trying to enter: ${JSON.stringify(message, null, 2)}`);
    client.send(JSON.stringify({
      type: 'error',
      data: {
        type: 'signInFailed',
        message: `Username ${userName} is taken.`
      }
    }));
  }
};

const handleMessage = messageJSON => {
  const { data } = messageJSON;
  const { user } = data;
  const messageData = Object.assign({}, data, { color: USER_BY_USERNAME[user].color });
  const chatEvent = Object.assign({}, messageJSON, { data: messageData, createdAt: new Date() });
  broadcastMessageToAllUsers(JSON.stringify(chatEvent));
};

const cleanUpClient = client => {
  const userName = Object.keys(USER_CLIENT_BY_USERNAME).find(userName => {
    return USER_CLIENT_BY_USERNAME[userName] === client;
  });
  if (userName) {
    delete USER_BY_USERNAME[userName];
    delete USER_CLIENT_BY_USERNAME[userName];
    broadcastMessageToAllUsers(JSON.stringify({
      type: 'userLeaveChat',
      data: {
        name: userName
      }
    }));
  }
};

function heartbeat(client) {
  client.isAlive = true;
};

const interval = setInterval(function ping() {
  server.clients.forEach(function each(client) {
    if (client.isAlive === false) {
      console.error('Client lost.');
      client.terminate();
      cleanUpClient(client);
    }

    client.isAlive = false;
    client.send(JSON.stringify({
      type: 'ping'
    }));
  });
}, 30000);

server.on('connection', function connection(client, req) {
  console.log('New connection.');
  // check origin
  const origin = req.headers.origin;
  if (originWhitelist.indexOf(origin) < 0) {
    console.log(`Invalid origin: ${origin}`);
    console.log('Closing a connection...');
    client.terminate(); // TODO: add error message
  }
  client.isAlive = true;

  client.on('message', function incoming(message) {
    const messageJSON = JSON.parse(message);
    const { type } = messageJSON;
    // for users that aren't signed in, only accept login messages
    if (!isClientLoggedIn(client) && type !== 'userEnterChat') {
      return;
    }
    if (type === 'userEnterChat') {
      handleUserEnterChat(client, messageJSON);
    } else if (type === 'message') {
      handleMessage(messageJSON);
    } else if (type === 'pong') {
      heartbeat(client);
    }
  });

  client.on('close', function close() {
    console.log('Connection closed...');
    cleanUpClient(client);
  });
});

server.on('close', function close() {
  clearInterval(interval);
});