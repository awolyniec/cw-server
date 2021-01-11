const WebSocket = require('ws');

const server = new WebSocket.Server({ port: 8080 });

// TODO: after server start, make sure all clients have to sign in right after connecting
// TODO: if a client drops, log them out
// TODO: implement origin-checking

const USERS = []; // in-memory data store

const broadcastMessageToAllUsers = (message) => {
  server.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

const handleUserEnterChat = (client, message) => {
  const { data: { userName, color } } = message;
  const isUserUnique = !USERS.find(user => user.name === userName);
  if (isUserUnique) {
    console.log(`User entering chat: ${JSON.stringify(message, null, 2)}`);
    USERS.push({
      name: userName,
      color
    });
    // inform all users that a user has entered (and confirm to the logged-in user that they have signed in)
    broadcastMessageToAllUsers(JSON.stringify({
      type: 'userEnterChat',
      data: {
        name: userName,
        color
      },
      createdAt: new Date()
    }));
    // TODO: only after user has entered chat do we allow them to receive chat messages
    const otherUsers = USERS.filter(user => user.name !== userName);
    client.send(JSON.stringify({
      type: 'initialSlateOfOtherUsers',
      data: otherUsers
    }));
  } else {
    console.error(`Non-unique user trying to enter: ${JSON.stringify(message, null, 2)}`);
    // TODO: reject connection; handle on front end
  }
};

server.on('connection', function connection(client) {
  console.log('New connection.');
  client.on('message', function incoming(message) {
    const messageJSON = JSON.parse(message);
    const { type } = messageJSON;
    if (type === 'userEnterChat') {
      handleUserEnterChat(client, messageJSON);
    }
  });
});