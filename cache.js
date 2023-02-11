const NodeCache = require("node-cache");

let cacheInstance;

module.exports = {
  createCacheInstance: function () {
    if (!cacheInstance) {
      cacheInstance = new NodeCache();
      console.log("cache instance created");
    }
  },

  getCache: function () {
    // needed this if check for integration tests
    if (!cacheInstance) {
      this.createCacheInstance();
    }

    return cacheInstance;
  },
};
