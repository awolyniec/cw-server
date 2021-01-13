const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });

// TODO: after server start, make sure all clients have to sign in right after connecting
// TODO: if a client drops, log them out
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

const cleanUpClient = client => {
  const userName = Object.keys(USER_CLIENT_BY_USERNAME).find(userName => {
    return USER_CLIENT_BY_USERNAME[userName] === client;
  });
  if (userName) {
    delete USER_BY_USERNAME[userName];
    delete USER_CLIENT_BY_USERNAME[userName];
  }
};

server.on('connection', function connection(client) {
  console.log('New connection.');
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
      const chatEvent = Object.assign({}, messageJSON, { createdAt: new Date() });
      broadcastMessageToAllUsers(JSON.stringify(chatEvent));
    }
  });

  client.on('close', function close() {
    console.log('Closing a connection...');
    cleanUpClient(client);
  });
});