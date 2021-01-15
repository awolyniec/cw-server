// TODO: this is lazy; put it on NPM
const extend = require('extend');

const env = process.env.NODE_ENV || 'development';

const config = {
  base: {},
  development: {
    originWhitelist: [
      'http://localhost:3000'
    ]
  },
  production: {
    originWhitelist: [
      'https://chattywatty-web.herokuapp.com',
      'http://chattywatty-web.herokuapp.com'
    ]
  }
};

module.exports = extend(true, {}, config.base, config[env]);